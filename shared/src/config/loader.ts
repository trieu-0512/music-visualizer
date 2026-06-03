import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig, QueueConfig, StorageConfig } from "./types.js";

const STORAGE_BACKENDS = new Set(["local"]);
const QUEUE_BACKENDS = new Set(["file"]);

/**
 * Resolve the workspace root (the directory containing `config/`).
 *
 * This file lives at `shared/src/config/loader.ts`, so the workspace root is
 * four levels up. The resolution is independent of `process.cwd()` so the
 * config can be located regardless of where a process is started from.
 */
function workspaceRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function defaultConfigPath(): string {
  return resolve(workspaceRoot(), "config", "default.json");
}

function assertStorageConfig(value: unknown): StorageConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error("config.storage must be an object");
  }
  const storage = value as Record<string, unknown>;
  if (typeof storage.backend !== "string" || !STORAGE_BACKENDS.has(storage.backend)) {
    throw new Error(
      `config.storage.backend must be one of: ${[...STORAGE_BACKENDS].join(", ")}`,
    );
  }
  if (typeof storage.rootDir !== "string" || storage.rootDir.length === 0) {
    throw new Error("config.storage.rootDir must be a non-empty string");
  }
  return { backend: storage.backend as StorageConfig["backend"], rootDir: storage.rootDir };
}

function assertQueueConfig(value: unknown): QueueConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error("config.queue must be an object");
  }
  const queue = value as Record<string, unknown>;
  if (typeof queue.backend !== "string" || !QUEUE_BACKENDS.has(queue.backend)) {
    throw new Error(`config.queue.backend must be one of: ${[...QUEUE_BACKENDS].join(", ")}`);
  }
  if (typeof queue.dir !== "string" || queue.dir.length === 0) {
    throw new Error("config.queue.dir must be a non-empty string");
  }
  return { backend: queue.backend as QueueConfig["backend"], dir: queue.dir };
}

/** Parse and validate raw config data into a typed {@link AppConfig}. */
export function parseConfig(data: unknown): AppConfig {
  if (typeof data !== "object" || data === null) {
    throw new Error("config must be a JSON object");
  }
  const obj = data as Record<string, unknown>;
  return {
    storage: assertStorageConfig(obj.storage),
    queue: assertQueueConfig(obj.queue),
  };
}

/**
 * Load the application configuration at startup (Req 13.4).
 *
 * Resolution order:
 *  1. Explicit `configPath` argument, if provided.
 *  2. `MV_CONFIG` environment variable, if set.
 *  3. `config/default.json` at the workspace root.
 *
 * Relative `rootDir` / `dir` values are returned as-is (resolved by callers
 * against the workspace root) so the config stays portable.
 */
export function loadConfig(configPath?: string): AppConfig {
  const candidate = configPath ?? process.env.MV_CONFIG ?? defaultConfigPath();
  const absolute = isAbsolute(candidate) ? candidate : resolve(workspaceRoot(), candidate);
  let raw: string;
  try {
    raw = readFileSync(absolute, "utf-8");
  } catch (cause) {
    throw new Error(`Unable to read config file at ${absolute}`, { cause });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Config file at ${absolute} is not valid JSON`, { cause });
  }
  return parseConfig(parsed);
}

export { workspaceRoot };
