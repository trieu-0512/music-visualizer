/**
 * Configuration contracts read at startup (Req 13.4).
 *
 * The active storage and queue backends are selected from this configuration
 * by the `createAssetStore` / `createJobQueue` factories. Additional backend
 * variants (e.g. "s3", "bullmq") can be added without changing callers.
 */

export type StorageBackend = "local";

export interface StorageConfig {
  backend: StorageBackend;
  /** Root directory for the local Asset_Store, relative to the workspace root. */
  rootDir: string;
}

export type QueueBackend = "file";

export interface QueueConfig {
  backend: QueueBackend;
  /** Directory for the file-based Job_Queue, relative to the workspace root. */
  dir: string;
}

export interface AppConfig {
  storage: StorageConfig;
  queue: QueueConfig;
}
