import { candidatePaths } from "../../assets/index.js";
import type { InspectedFolder } from "./types.js";

/**
 * Folder inspection helpers for `POST /projects/import-folder`.
 *
 * Pure path-matching / role-discovery logic extracted from the projects router
 * (Architecture Upgrade PR-12). No storage or project creation side effects.
 */

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const CORE_REQUIRED_ASSET_ROLES = ["audio", "background", "songLogo", "channelLogo"] as const;
const LEGACY_LETTER_ROLES = LETTERS.map((letter) => `letter:${letter}`);
const OPTIONAL_ASSET_ROLES = ["originalLyrics"] as const;
const AUTHORING_FILE_NAMES = new Set([
  "generation-lyrics.txt",
  "display-lyrics.txt",
  "style-prompt.txt",
  "exclude-styles.txt",
  "object-prompts.json",
  "learning-blocks.json",
  "sections.json",
  "song-script.json",
]);

export const REQUIRED_IMPORT_PATHS = [
  ...CORE_REQUIRED_ASSET_ROLES.flatMap((role) => candidatePaths(role)),
  ...LEGACY_LETTER_ROLES.flatMap((role) => candidatePaths(role)),
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
  const authoringFiles = new Map<string, Express.Multer.File>();
  const missing: string[] = [];
  const mappingFile = byPath.get("authoring/mapping.json");
  for (const [relativePath, file] of byPath) {
    if (relativePath.startsWith("authoring/") && relativePath !== "authoring/mapping.json") {
      authoringFiles.set(relativePath, file);
    }
  }

  for (const role of CORE_REQUIRED_ASSET_ROLES) {
    const match = firstPresent(byPath, candidatePaths(role));
    if (match === null) missing.push(role);
    else assets.set(match.relativePath, match.file);
  }

  for (const letter of LETTERS) {
    const letterMatch = firstPresent(byPath, candidatePaths(`letter:${letter}`));
    const objectMatch = firstPresent(byPath, candidatePaths(`object:${letter}`));
    const sourceMatch = firstPresent(byPath, candidatePaths(`source:${letter}`));
    for (const match of [letterMatch, objectMatch, sourceMatch]) {
      if (match !== null) assets.set(match.relativePath, match.file);
    }

    if (mappingFile) {
      // Theme-first import may arrive with raw combined images only. The
      // prepare-assets worker will derive processed letter + object assets.
      if ((letterMatch === null || objectMatch === null) && sourceMatch === null) {
        missing.push(`source:${letter}`);
      }
    } else if (letterMatch === null) {
      // Legacy projects have no mapping/segmentation stage and still require
      // one processed letter asset per A-Z key.
      missing.push(`letter:${letter}`);
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
    mappingFile,
    authoringFiles,
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
    const assetSubdir = parts[assetIndex + 1];
    const fileName = parts.at(-1);
    if (
      fileName &&
      (assetSubdir === "letters" || assetSubdir === "objects" || assetSubdir === "source-images")
    ) {
      const kind =
        assetSubdir === "letters" ? "letter" : assetSubdir === "objects" ? "object" : "source";
      const keyedPath = looseKeyedPath(fileName, kind);
      if (keyedPath !== null) {
        return {
          relativePath: keyedPath,
          rootName: assetIndex > 0 ? parts[assetIndex - 1]! : null,
        };
      }
    }
    return {
      relativePath: parts.slice(assetIndex).join("/"),
      rootName: assetIndex > 0 ? parts[assetIndex - 1]! : null,
    };
  }

  const authoringIndex = parts.lastIndexOf("authoring");
  if (authoringIndex >= 0) {
    const relative = parts.slice(authoringIndex).join("/");
    const fileName = parts.at(-1) ?? "";
    if (
      relative === "authoring/mapping.json" ||
      AUTHORING_FILE_NAMES.has(fileName) ||
      fileName.toLowerCase().endsWith(".lrc")
    ) {
      return {
        relativePath: relative,
        rootName: authoringIndex > 0 ? parts[authoringIndex - 1]! : null,
      };
    }
  }

  const artifactIndex = parts.lastIndexOf("artifacts");
  if (artifactIndex >= 0) {
    return {
      relativePath: parts.slice(artifactIndex).join("/"),
      rootName: artifactIndex > 0 ? parts[artifactIndex - 1]! : null,
    };
  }

  const last = parts.at(-1);
  if (last === "mapping.json") {
    return {
      relativePath: "authoring/mapping.json",
      rootName: parts.length > 1 ? parts.at(-2)! : null,
    };
  }

  if (last === "metadata.json" || last === "project.json") {
    return {
      relativePath: last,
      rootName: parts.length > 1 ? parts.at(-2)! : null,
    };
  }

  let keyedDir = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part === "letters" || part === "objects" || part === "source-images") {
      keyedDir = i;
      break;
    }
  }
  if (keyedDir >= 0 && last) {
    const kind = parts[keyedDir] === "letters" ? "letter" : parts[keyedDir] === "objects" ? "object" : "source";
    const keyedPath = looseKeyedPath(last, kind);
    if (keyedPath !== null) {
      return {
        relativePath: keyedPath,
        rootName: keyedDir > 0 ? parts[keyedDir - 1]! : null,
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
  return looseKeyedPath(fileName, "letter");
}

function looseKeyedPath(
  fileName: string,
  kind: "letter" | "object" | "source",
): string | null {
  const parsed = parseLooseName(fileName);
  if (parsed === null) return null;
  const keyMatch =
    kind === "letter"
      ? parsed.stem.match(/^([a-z])$/)
      : parsed.stem.match(/^([a-z])(?:$|-)/);
  const key = keyMatch?.[1];
  if (!key) return null;
  const accepted =
    kind === "letter"
      ? [".svg", ".png", ".webp"]
      : kind === "object"
        ? [".png", ".webp", ".svg"]
        : [".png", ".jpg", ".jpeg", ".webp"];
  if (!accepted.includes(parsed.ext)) return null;
  const dir = kind === "letter" ? "letters" : kind === "object" ? "objects" : "source-images";
  return `assets/${dir}/${key.toUpperCase()}${parsed.ext}`;
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
