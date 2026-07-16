import { Buffer } from "node:buffer";
import { Router } from "express";
import {
  validateAudioAnalysis,
  validateLyrics,
  type AudioAnalysisJson,
  type LyricsJson,
  type VideoFormat,
} from "@music-visualizer/shared";
import { buildConfig } from "../config/index.js";
import { listPresentArtifacts } from "../artifacts/index.js";
import { candidatePaths, computeReadiness } from "../assets/index.js";
import { ApiError, asyncHandler, validationError } from "../http/errors.js";
import { createMemoryUpload } from "../http/upload.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";

/**
 * Project routes (`backend`).
 *
 * - `POST /projects` — create a project, assign a unique `Project_Id`, record
 *   the supplied `Project_Metadata` (Req 1.1, 1.2).
 * - `GET /projects/:id` — return the project metadata together with the list of
 *   stored assets and generated artifacts (Req 1.4); unknown ids resolve to a
 *   `NOT_FOUND` envelope (Req 1.5).
 *
 * The router is mounted at the application root so its paths are `/projects`
 * and `/projects/:id`. Later tasks mount sibling routers (assets, jobs,
 * config, artifacts) on the same app.
 */
export function createProjectsRouter(service: ProjectService, store: AssetStore): Router {
  const router = Router();
  const upload = createMemoryUpload({ preservePath: true });

  router.post(
    "/projects/import-folder",
    upload.array("files"),
    asyncHandler(async (req, res) => {
      const uploadedFiles = (req.files ?? []) as Express.Multer.File[];
      if (uploadedFiles.length === 0) {
        throw validationError("Expected multipart files in a field named 'files'");
      }

      const folder = inspectFolder(uploadedFiles, requestPaths(req.body));
      if (folder.missing.length > 0) {
        throw new ApiError(
          "MISSING_REQUIREMENTS",
          "Cannot import folder: required files are missing",
          { missing: folder.missing, requiredPaths: REQUIRED_IMPORT_PATHS },
        );
      }

      const importedMetadata = folder.metadataFile
        ? parseMetadataFile(folder.metadataFile)
        : {};
      const metadata = metadataFromRequest(req.body, {
        songName: importedMetadata.songName ?? folder.songName,
        singerName: importedMetadata.singerName ?? "Imported Folder",
        videoFormat: importedMetadata.videoFormat ?? "both",
      });

      const project = await service.create({
        songName: metadata.songName,
        singerName: metadata.singerName,
        videoFormat: metadata.videoFormat,
      });

      for (const [relativePath, file] of folder.assets) {
        await store.write({ projectId: project.projectId, relativePath }, file.buffer);
      }

      if (folder.generatedArtifacts.lyrics) {
        const lyrics = parseArtifact<LyricsJson>(
          folder.generatedArtifacts.lyrics,
          validateLyrics,
          "artifacts/lyrics.json",
        );
        await store.write(
          { projectId: project.projectId, relativePath: "artifacts/lyrics.json" },
          Buffer.from(JSON.stringify(lyrics, null, 2), "utf-8"),
        );
      }

      if (folder.generatedArtifacts.audioAnalysis) {
        const analysis = parseArtifact<AudioAnalysisJson>(
          folder.generatedArtifacts.audioAnalysis,
          validateAudioAnalysis,
          "artifacts/audio-analysis.json",
        );
        await store.write(
          { projectId: project.projectId, relativePath: "artifacts/audio-analysis.json" },
          Buffer.from(JSON.stringify(analysis, null, 2), "utf-8"),
        );
      }

      let config = null;
      if (folder.generatedArtifacts.lyrics && folder.generatedArtifacts.audioAnalysis) {
        const configResult = await buildConfig(project.projectId, store, project);
        if (!configResult.ok) {
          throw configResult.error;
        }
        config = configResult.value;
      }

      const readiness = await computeReadiness(store, project.projectId);
      const artifacts = await listPresentArtifacts(store, project.projectId);
      res.status(201).json({
        project,
        readiness,
        config,
        artifacts,
      });
    }),
  );

  router.post(
    "/projects",
    asyncHandler(async (req, res) => {
      const record = await service.create(req.body);
      res.status(201).json(record);
    }),
  );

  router.get(
    "/projects/:id",
    asyncHandler(async (req, res) => {
      const view = await service.getView(String(req.params.id));
      res.status(200).json(view);
    }),
  );

  return router;
}

const REQUIRED_ASSET_ROLES = [
  "audio",
  "background",
  "songLogo",
  "channelLogo",
  ...Array.from({ length: 26 }, (_, i) => `letter:${String.fromCharCode(65 + i)}`),
] as const;

const OPTIONAL_ASSET_ROLES = ["originalLyrics"] as const;

const REQUIRED_IMPORT_PATHS = [
  ...REQUIRED_ASSET_ROLES.flatMap((role) => candidatePaths(role)),
] as const;

interface InspectedFolder {
  songName: string;
  assets: Map<string, Express.Multer.File>;
  generatedArtifacts: {
    lyrics?: Express.Multer.File;
    audioAnalysis?: Express.Multer.File;
  };
  metadataFile?: Express.Multer.File;
  missing: string[];
}

function inspectFolder(
  files: Express.Multer.File[],
  paths: string[],
): InspectedFolder {
  const byPath = new Map<string, Express.Multer.File>();
  const rootNames = new Set<string>();

  files.forEach((file, index) => {
    const rawPath = paths[index] ?? file.originalname;
    const normalized = normalizeFolderPath(rawPath);
    if (normalized === null) return;
    byPath.set(normalized.relativePath, file);
    if (normalized.rootName) rootNames.add(normalized.rootName);
  });

  const assets = new Map<string, Express.Multer.File>();
  const missing: string[] = [];

  for (const role of REQUIRED_ASSET_ROLES) {
    const match = firstPresent(byPath, candidatePaths(role));
    if (match === null) {
      missing.push(role);
    } else {
      assets.set(match.relativePath, match.file);
    }
  }

  for (const role of OPTIONAL_ASSET_ROLES) {
    const match = firstPresent(byPath, candidatePaths(role));
    if (match !== null) {
      assets.set(match.relativePath, match.file);
    }
  }

  return {
    songName: displayName([...rootNames][0] ?? "Imported Folder"),
    assets,
    generatedArtifacts: {
      lyrics: byPath.get("artifacts/lyrics.json"),
      audioAnalysis: byPath.get("artifacts/audio-analysis.json"),
    },
    metadataFile: byPath.get("metadata.json") ?? byPath.get("project.json"),
    missing,
  };
}

function firstPresent(
  byPath: Map<string, Express.Multer.File>,
  candidates: string[],
): { relativePath: string; file: Express.Multer.File } | null {
  for (const relativePath of candidates) {
    const file = byPath.get(relativePath);
    if (file) return { relativePath, file };
  }
  return null;
}

function normalizeFolderPath(
  rawName: string,
): { relativePath: string; rootName: string | null } | null {
  const parts = rawName
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0 && part !== ".");

  if (parts.length === 0 || parts.some((part) => part === "..")) return null;

  const assetIndex = parts.lastIndexOf("assets");
  if (assetIndex >= 0) {
    return {
      relativePath: parts.slice(assetIndex).join("/"),
      rootName: assetIndex > 0 ? parts[assetIndex - 1]! : null,
    };
  }

  const artifactIndex = parts.lastIndexOf("artifacts");
  if (artifactIndex >= 0) {
    return {
      relativePath: parts.slice(artifactIndex).join("/"),
      rootName: artifactIndex > 0 ? parts[artifactIndex - 1]! : null,
    };
  }

  const last = parts.at(-1);
  if (last === "metadata.json" || last === "project.json") {
    return {
      relativePath: last,
      rootName: parts.length > 1 ? parts.at(-2)! : null,
    };
  }

  const lettersIndex = parts.lastIndexOf("letters");
  if (lettersIndex >= 0 && last) {
    const letterPath = looseLetterPath(last);
    if (letterPath !== null) {
      return {
        relativePath: letterPath,
        rootName: lettersIndex > 0 ? parts[lettersIndex - 1]! : null,
      };
    }
  }

  if (last) {
    const relativePath = looseAssetPath(last);
    if (relativePath !== null) {
      return {
        relativePath,
        rootName: parts.length > 1 ? parts.at(-2)! : null,
      };
    }
  }

  return null;
}

function looseAssetPath(fileName: string): string | null {
  const parsed = parseLooseName(fileName);
  if (parsed === null) return null;
  const { stem, ext } = parsed;

  if (
    (ext === ".mp3" || ext === ".wav") &&
    (["audio", "song", "track", "music"].includes(stem) || /^\d{4}$/.test(stem))
  ) {
    return `assets/audio${ext}`;
  }
  if (
    [".png", ".jpg", ".jpeg", ".webp"].includes(ext) &&
    ["background", "bg", "backdrop", "cover"].includes(stem)
  ) {
    return `assets/background${ext}`;
  }
  if (
    (ext === ".png" || ext === ".svg") &&
    ["song-logo", "logo-song", "logo-bai-hat", "songlogo", "title-logo"].includes(stem)
  ) {
    return `assets/song-logo${ext}`;
  }
  if (
    (ext === ".png" || ext === ".svg") &&
    ["channel-logo", "logo-channel", "logo-kenh", "channellogo", "channel"].includes(stem)
  ) {
    return `assets/channel-logo${ext}`;
  }

  const letterPath = looseLetterPath(fileName);
  if (letterPath !== null) return letterPath;

  if (
    (ext === ".txt" || ext === ".json" || ext === ".md") &&
    (["original-lyrics", "original-lyric", "lyrics", "lyric"].includes(stem) ||
      /^\d{4}-lyrics$/.test(stem))
  ) {
    return `assets/original-lyrics${ext}`;
  }
  if (ext === ".json" && stem === "audio-analysis") {
    return "artifacts/audio-analysis.json";
  }
  return null;
}

function looseLetterPath(fileName: string): string | null {
  const parsed = parseLooseName(fileName);
  if (parsed === null || parsed.ext !== ".svg" || !/^[a-z]$/.test(parsed.stem)) {
    return null;
  }
  return `assets/letters/${parsed.stem.toUpperCase()}.svg`;
}

function parseLooseName(fileName: string): { stem: string; ext: string } | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = fileName.slice(dot).toLowerCase();
  const stem = fileName
    .slice(0, dot)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return stem.length > 0 ? { stem, ext } : null;
}

function displayName(raw: string): string {
  return raw.replace(/[_-]+/g, " ").trim() || "Imported Folder";
}

function parseArtifact<T>(
  file: Express.Multer.File,
  validate: (data: unknown) => { ok: true; value: T } | { ok: false; error: unknown },
  label: string,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.buffer.toString("utf-8"));
  } catch (cause) {
    throw validationError(`${label} is not valid JSON`, {
      artifact: label,
      reason: cause instanceof Error ? cause.message : String(cause),
    });
  }

  const result = validate(parsed);
  if (!result.ok) {
    throw validationError(`${label} does not match the required schema`, {
      artifact: label,
      errors: result.error,
    });
  }
  return result.value;
}

function requestPaths(body: unknown): string[] {
  const paths = (body as { paths?: unknown } | null)?.paths;
  if (Array.isArray(paths)) return paths.map(String);
  if (typeof paths === "string") return [paths];
  return [];
}

interface ImportedMetadata {
  songName?: string;
  singerName?: string;
  videoFormat?: VideoFormat;
}

function parseMetadataFile(file: Express.Multer.File): ImportedMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.buffer.toString("utf-8"));
  } catch (cause) {
    throw validationError("metadata.json is not valid JSON", {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
  }
  if (parsed === null || typeof parsed !== "object") {
    throw validationError("metadata.json must be a JSON object");
  }
  return pickMetadata(parsed as Record<string, unknown>);
}

function metadataFromRequest(
  body: unknown,
  fallback: { songName: string; singerName: string; videoFormat: VideoFormat },
): { songName: string; singerName: string; videoFormat: VideoFormat } {
  const bodyObject =
    body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const metadata =
    typeof bodyObject.metadata === "string"
      ? parseMetadataString(bodyObject.metadata)
      : pickMetadata(bodyObject);
  return {
    songName: cleanString(metadata.songName) ?? fallback.songName,
    singerName: cleanString(metadata.singerName) ?? fallback.singerName,
    videoFormat: metadata.videoFormat ?? fallback.videoFormat,
  };
}

function parseMetadataString(raw: unknown): ImportedMetadata {
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return {};
    return pickMetadata(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

function pickMetadata(raw: Record<string, unknown>): ImportedMetadata {
  const videoFormat = raw.videoFormat;
  return {
    songName: cleanString(raw.songName) ?? cleanString(raw.title),
    singerName: cleanString(raw.singerName) ?? cleanString(raw.artist),
    videoFormat:
      videoFormat === "landscape" || videoFormat === "portrait" || videoFormat === "both"
        ? videoFormat
        : undefined,
  };
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
