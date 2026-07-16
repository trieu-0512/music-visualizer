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

/**
 * Defaults for queue lease / recovery (Architecture Upgrade KD-3, KD-4, KD-16, KD-20).
 * Applied by config loaders and queue constructors when keys are omitted.
 */
export const QUEUE_CONFIG_DEFAULTS = {
  leaseMs: 120_000,
  heartbeatIntervalMs: 15_000,
  maxRequeuesAudio: 1,
  maxRequeuesRender: 0,
  /** Full lease recovery on running jobs; false until PR-04c enables it. */
  leaseRecoveryEnabled: true,
} as const;

export interface QueueConfig {
  backend: QueueBackend;
  /** Directory for the file-based Job_Queue, relative to the workspace root. */
  dir: string;
  /** Stale lease threshold in ms (default 120_000). */
  leaseMs?: number;
  /** Worker heartbeat interval in ms (default 15_000). */
  heartbeatIntervalMs?: number;
  /** Max requeues for transcribe/analyze before fail (default 1). */
  maxRequeuesAudio?: number;
  /** Max requeues for render before fail (default 0 = fail stale). */
  maxRequeuesRender?: number;
  /**
   * When true, recoverStale applies KD-4 to expired running jobs.
   * When false, only orphan locks are cleaned (never steal running).
   * Default true after PR-04c (heartbeats required for long jobs).
   */
  leaseRecoveryEnabled?: boolean;
}

export interface AppConfig {
  storage: StorageConfig;
  queue: QueueConfig;
}
