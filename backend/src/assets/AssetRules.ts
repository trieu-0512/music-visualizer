import { Buffer } from "node:buffer";
import { extname } from "node:path";
import { ApiError, validationError } from "../http/errors.js";
import type { AssetStore } from "../storage/index.js";

/**
 * Asset role rules, upload validation, standardized storage paths, and
 * readiness computation (`backend`, Req 2).
 *
 * Every asset is addressed by `Project_Id` + a standardized relative path under
 * `assets/` (design "Storage Layout"). This module is the single source of
 * truth for which file types each role accepts (`ROLE_RULES`), where each role
 * is stored, and which roles a project must have before it is render-ready.
 */

/** Allowed extensions and MIME types for an asset role (design `ROLE_RULES`). */
export interface RoleRule {
  exts: string[];
  mimes: string[];
}

/**
 * Accepted file types per asset role (design `ROLE_RULES`).
 *
 * The 26 letter roles (`letter:A`..`letter:Z`) all share the single `letter`
 * rule; `baseRole` strips the letter suffix before lookup.
 */
export const ROLE_RULES: Record<string, RoleRule> = {
  audio: { exts: [".mp3", ".wav"], mimes: ["audio/mpeg", "audio/wav", "audio/x-wav"] },
  originalLyrics: {
    exts: [".txt", ".json", ".md"],
    mimes: ["text/plain", "application/json", "text/markdown"],
  },
  background: {
    exts: [".png", ".jpg", ".jpeg", ".webp"],
    mimes: ["image/png", "image/jpeg", "image/webp"],
  },
  songLogo: { exts: [".png", ".svg"], mimes: ["image/png", "image/svg+xml"] },
  channelLogo: { exts: [".png", ".svg"], mimes: ["image/png", "image/svg+xml"] },
  letter: { exts: [".svg"], mimes: ["image/svg+xml"] }, // role "letter:A".."letter:Z"
};

/** The 26 letter keys A–Z (Req 2.1). */
export const LETTERS: string[] = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * Required asset roles a project must have to be render-ready (Req 2.8).
 *
 * `originalLyrics` is intentionally excluded: it is optional (Req 2.5). The
 * naming (`letter:A`..`letter:Z`) is shared with the Config_Builder so missing
 * items read consistently across endpoints.
 */
export const REQUIRED_ROLES: string[] = [
  "audio",
  "background",
  "songLogo",
  "channelLogo",
  ...LETTERS.map((letter) => `letter:${letter}`),
];

/** Path stems (extension supplied by the upload) for the non-letter roles. */
const ROLE_STEMS: Record<string, string> = {
  audio: "assets/audio",
  originalLyrics: "assets/original-lyrics",
  background: "assets/background",
  songLogo: "assets/song-logo",
  channelLogo: "assets/channel-logo",
};

/** A file received over multipart upload, abstracted from the HTTP layer. */
export interface UploadedFile {
  /** Client-supplied file name, used to derive the extension. */
  originalName: string;
  /** Client-supplied MIME type. */
  mimeType: string;
  /** The file bytes. */
  buffer: Buffer;
}

/** Readiness report for a project (Req 2.8). */
export interface ReadinessReport {
  projectId: string;
  /** True when every required role has a stored file. */
  ready: boolean;
  /** Required roles that have a stored file. */
  present: string[];
  /** Required roles with no stored file. */
  missing: string[];
}

/**
 * Strip the letter suffix from a role so all `letter:X` roles map to the single
 * `letter` rule; every other role is its own base (design `baseRole`).
 */
export function baseRole(role: string): string {
  return role.startsWith("letter:") ? "letter" : role;
}

/**
 * Extract the A–Z key from a `letter:X` role, or `null` when the suffix is not
 * a single uppercase letter A–Z.
 */
export function letterKey(role: string): string | null {
  if (!role.startsWith("letter:")) return null;
  const key = role.slice("letter:".length);
  return /^[A-Z]$/.test(key) ? key : null;
}

/**
 * Validate an uploaded file against the rules for `role` (Req 2.3–2.6).
 *
 * Throws an {@link ApiError}:
 * - `VALIDATION_ERROR` for an unknown role or a malformed `letter:X` key.
 * - `UNSUPPORTED_FORMAT` when an audio upload is neither MP3 nor WAV, with a
 *   message stating the accepted formats (Req 2.4).
 * - `TYPE_MISMATCH` when any other role's file type does not match the role,
 *   with a message identifying the expected type(s) (Req 2.6).
 */
export function validateUpload(role: string, file: UploadedFile): void {
  const base = baseRole(role);
  const rule = ROLE_RULES[base];
  if (rule === undefined) {
    throw validationError(`Unknown asset role: ${role}`, { role });
  }
  if (base === "letter" && letterKey(role) === null) {
    throw validationError(
      `Letter role must be one of letter:A through letter:Z, got: ${role}`,
      { role },
    );
  }
  const ext = extname(file.originalName).toLowerCase();
  const matches = rule.exts.includes(ext) && rule.mimes.includes(file.mimeType);
  if (matches) return;

  if (base === "audio") {
    throw new ApiError(
      "UNSUPPORTED_FORMAT",
      `Audio_Asset must be MP3 or WAV (accepted formats: ${rule.exts.join(", ")})`,
      { role, accepted: rule.exts },
    );
  }
  throw new ApiError(
    "TYPE_MISMATCH",
    `Asset role '${role}' expects one of ${rule.exts.join(", ")}`,
    { role, accepted: rule.exts },
  );
}

/**
 * The standardized storage path for a validated upload of `role` carrying
 * extension `ext` (design "Storage Layout"). Letters always resolve to
 * `assets/letters/{X}.svg` regardless of the supplied extension.
 */
export function assetRelativePath(role: string, ext: string): string {
  const base = baseRole(role);
  if (base === "letter") {
    const key = letterKey(role);
    if (key === null) throw validationError(`Invalid letter role: ${role}`, { role });
    return `assets/letters/${key}.svg`;
  }
  const stem = ROLE_STEMS[base];
  if (stem === undefined) throw validationError(`Unknown asset role: ${role}`, { role });
  return `${stem}${ext.toLowerCase()}`;
}

/**
 * Every relative path a stored file for `role` could occupy. Used to delete any
 * prior file before a re-upload (Req 2.7) and to detect presence for readiness.
 * A non-letter role can occupy one path per allowed extension; a letter role
 * occupies exactly its `.svg` path.
 */
export function candidatePaths(role: string): string[] {
  const base = baseRole(role);
  if (base === "letter") {
    const key = letterKey(role);
    return key === null ? [] : [`assets/letters/${key}.svg`];
  }
  const rule = ROLE_RULES[base];
  const stem = ROLE_STEMS[base];
  if (rule === undefined || stem === undefined) return [];
  return rule.exts.map((ext) => `${stem}${ext}`);
}

/**
 * Store an uploaded file for `role`, replacing any previously stored file for
 * that role (Req 2.1, 2.2, 2.3, 2.5, 2.7).
 *
 * Validation is the caller's responsibility (see {@link validateUpload}). The
 * prior file is removed first — including when a re-upload changes the
 * extension (e.g. `audio.mp3` → `audio.wav`) — so exactly one file remains for
 * the role. Returns the standardized relative path the file was written to.
 */
export async function storeAsset(
  store: AssetStore,
  projectId: string,
  role: string,
  file: UploadedFile,
): Promise<string> {
  const ext = extname(file.originalName).toLowerCase();
  const target = assetRelativePath(role, ext);
  // Remove any existing file(s) for this role so re-upload replaces, never
  // accumulates, even when the extension differs from the prior upload.
  await Promise.all(
    candidatePaths(role).map((relativePath) => store.delete({ projectId, relativePath })),
  );
  await store.write({ projectId, relativePath: target }, file.buffer);
  return target;
}

/**
 * Report which required roles are present and which are missing for a project
 * (Req 2.8). A role is present when any of its candidate paths exists in the
 * Asset_Store.
 */
export async function computeReadiness(
  store: AssetStore,
  projectId: string,
): Promise<ReadinessReport> {
  const stored = new Set(await store.list(projectId, "assets/"));
  const present: string[] = [];
  const missing: string[] = [];
  for (const role of REQUIRED_ROLES) {
    if (candidatePaths(role).some((relativePath) => stored.has(relativePath))) {
      present.push(role);
    } else {
      missing.push(role);
    }
  }
  return { projectId, ready: missing.length === 0, present, missing };
}
