import { candidatePaths } from "../../assets/index.js";
import type { InspectedFolder } from "./types.js";

/**
 * Folder inspection helpers for `POST /projects/import-folder`.
 *
 * Pure path-matching / role-discovery logic extracted from the projects router
 * (Architecture Upgrade PR-12). No storage or project creation side effects.
 */

const REQUIRED_ASSET_ROLES = [
  "audio",
  "background",
  "songLogo",
  "channelLogo",
  ...Array.from({ length: 26 }, (_, i) => `letter:${String.fromCharCode(65 + i)}`),
] as const;

const OPTIONAL_ASSET_ROLES = ["originalLyrics"] as const;

export const REQUIRED_IMPORT_PATHS = [
  ...REQUIRED_ASSET_ROLES.flatMap((role) => candidatePaths(role)),
] as const;

export function inspectFolder(
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

export function normalizeFolderPath(
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
