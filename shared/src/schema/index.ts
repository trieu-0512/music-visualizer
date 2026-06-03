/**
 * JSON Schemas for the canonical artifacts, authored as plain `.json` files so
 * both Node (via a validator such as ajv) and the Python Audio_Worker load the
 * identical contract (Req 15.4).
 *
 * The `.json` files in this directory are the single source of truth. This
 * module re-exports them as objects for ergonomic Node consumption and exposes
 * the on-disk directory so non-bundled consumers (and tooling) can locate them.
 * Browser bundles should import from `schema/objects.ts` through the package
 * root instead, because the path helpers below use Node built-ins.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_FILES } from "./objects.js";
export {
  SCHEMAS,
  SCHEMA_FILES,
  lyricsSchema,
  audioAnalysisSchema,
  projectConfigSchema,
} from "./objects.js";

/** Absolute path to the directory containing the schema `.json` files. */
export function schemaDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** Absolute path to a specific schema file on disk. */
export function schemaPath(name: keyof typeof SCHEMA_FILES): string {
  return resolve(schemaDir(), SCHEMA_FILES[name]);
}
