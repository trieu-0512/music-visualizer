import multer, { type Multer } from "multer";

/**
 * Shared multipart upload configuration (Architecture Upgrade KD-7 / PR-07).
 *
 * Memory storage is kept for the MVP (bytes go straight into Asset_Store), but
 * hard size/count limits prevent unbounded RAM use on import-folder.
 */

/** Default per-file size cap (200 MiB). */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

/** Default max files per request (enough for A–Z + logos + audio + metadata). */
export const DEFAULT_MAX_FILES = 80;

export interface MemoryUploadOptions {
  /** Max bytes per file. Defaults to {@link DEFAULT_MAX_FILE_SIZE_BYTES}. */
  fileSize?: number;
  /** Max files per request. Defaults to {@link DEFAULT_MAX_FILES}. */
  files?: number;
  /** Preserve relative paths from `webkitRelativePath` (import-folder). */
  preservePath?: boolean;
}

/** Build a multer instance with memory storage and hard limits. */
export function createMemoryUpload(options: MemoryUploadOptions = {}): Multer {
  return multer({
    storage: multer.memoryStorage(),
    preservePath: options.preservePath ?? false,
    limits: {
      fileSize: options.fileSize ?? DEFAULT_MAX_FILE_SIZE_BYTES,
      files: options.files ?? DEFAULT_MAX_FILES,
    },
  });
}
