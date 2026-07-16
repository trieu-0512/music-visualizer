import { Buffer } from "node:buffer";
import {
  validateAudioAnalysis,
  validateLyrics,
  type AudioAnalysisJson,
  type LyricsJson,
  type VideoFormat,
} from "@music-visualizer/shared";
import { buildConfig } from "../../config/index.js";
import { listPresentArtifacts } from "../../artifacts/index.js";
import { computeReadiness } from "../../assets/index.js";
import { ApiError, validationError } from "../../http/errors.js";
import type { ProjectService } from "../ProjectService.js";
import type { AssetStore } from "../../storage/index.js";
import { inspectFolder, REQUIRED_IMPORT_PATHS } from "./FolderInspector.js";
import type {
  FolderImportResult,
  ImportedMetadataFields,
  ImportMetadata,
} from "./types.js";

/**
 * ImportFolderService (`backend`, Architecture Upgrade PR-12).
 *
 * Owns the full import-folder pipeline formerly inlined in the projects router:
 * inspect uploaded paths, validate required roles, create the project, write
 * assets/artifacts, and optionally build config.
 */
export class ImportFolderService {
  constructor(
    private readonly service: ProjectService,
    private readonly store: AssetStore,
  ) {}

  async import(
    files: Express.Multer.File[],
    body: unknown,
  ): Promise<FolderImportResult> {
    if (files.length === 0) {
      throw validationError("Expected multipart files in a field named 'files'");
    }

    const folder = inspectFolder(files, requestPaths(body));
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
    const metadata = metadataFromRequest(body, {
      songName: importedMetadata.songName ?? folder.songName,
      singerName: importedMetadata.singerName ?? "Imported Folder",
      videoFormat: importedMetadata.videoFormat ?? "both",
    });

    const project = await this.service.create({
      songName: metadata.songName,
      singerName: metadata.singerName,
      videoFormat: metadata.videoFormat,
    });

    for (const [relativePath, file] of folder.assets) {
      await this.store.write({ projectId: project.projectId, relativePath }, file.buffer);
    }

    if (folder.generatedArtifacts.lyrics) {
      const lyrics = parseArtifact<LyricsJson>(
        folder.generatedArtifacts.lyrics,
        validateLyrics,
        "artifacts/lyrics.json",
      );
      await this.store.write(
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
      await this.store.write(
        { projectId: project.projectId, relativePath: "artifacts/audio-analysis.json" },
        Buffer.from(JSON.stringify(analysis, null, 2), "utf-8"),
      );
    }

    let config = null;
    if (folder.generatedArtifacts.lyrics && folder.generatedArtifacts.audioAnalysis) {
      const configResult = await buildConfig(project.projectId, this.store, project);
      if (!configResult.ok) {
        throw configResult.error;
      }
      config = configResult.value;
    }

    const readiness = await computeReadiness(this.store, project.projectId);
    const artifacts = await listPresentArtifacts(this.store, project.projectId);
    return {
      project,
      readiness,
      config,
      artifacts,
    };
  }
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

function parseMetadataFile(file: Express.Multer.File): ImportedMetadataFields {
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
  fallback: ImportMetadata,
): ImportMetadata {
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

function parseMetadataString(raw: unknown): ImportedMetadataFields {
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return {};
    return pickMetadata(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

function pickMetadata(raw: Record<string, unknown>): ImportedMetadataFields {
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
