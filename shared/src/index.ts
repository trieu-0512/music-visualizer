/**
 * `@music-visualizer/shared` — browser-safe source of truth for artifact
 * schemas, types, and validators consumed by every area (Req 15.4).
 *
 * Node-only startup configuration helpers live under
 * `@music-visualizer/shared/config` so browser bundles do not pull in `node:fs`.
 */
export type {
  AppConfig,
  StorageConfig,
  StorageBackend,
  QueueConfig,
  QueueBackend,
} from "./config/types.js";
export * from "./types/index.js";
export * from "./schema/objects.js";
export * from "./result.js";
export * from "./validate.js";
