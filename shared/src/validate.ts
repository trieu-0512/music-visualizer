/**
 * Artifact validators — one per canonical artifact — built directly from the
 * JSON Schemas in `shared/src/schema/` so the schemas remain the single source
 * of truth shared with the Python Audio_Worker (Req 15.4).
 *
 * Each validator returns a {@link Result} carrying either the typed, validated
 * artifact or a list of structured {@link ValidationError}s, so callers can
 * handle malformed artifacts without exception handling.
 */
import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";

import { err, ok, type Result } from "./result.js";
import {
  audioAnalysisSchema,
  lyricsSchema,
  projectConfigSchema,
  learningMapSchema,
} from "./schema/objects.js";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
  LearningMapJson,
} from "./types/index.js";

/** A single structured validation failure. */
export interface ValidationError {
  /**
   * JSON Pointer to the offending value within the validated data
   * (e.g. `"/lines/0/start"`); `"/"` denotes the root document.
   */
  path: string;
  /** Human-readable description of why the value is invalid. */
  message: string;
}

/**
 * Shared Ajv instance. `strict` is disabled because the schemas use keywords
 * (`$defs`, `const`, `propertyNames`) intended to stay portable to the Python
 * validator; `allErrors` lets a single call report every problem at once.
 */
const ajv = new Ajv({ allErrors: true, strict: false });

const validateLyricsSchema: ValidateFunction<LyricsJson> =
  ajv.compile<LyricsJson>(lyricsSchema);
const validateAudioAnalysisSchema: ValidateFunction<AudioAnalysisJson> =
  ajv.compile<AudioAnalysisJson>(audioAnalysisSchema);
const validateProjectConfigSchema: ValidateFunction<ProjectConfigJson> =
  ajv.compile<ProjectConfigJson>(projectConfigSchema);
const validateLearningMapSchema: ValidateFunction<LearningMapJson> =
  ajv.compile<LearningMapJson>(learningMapSchema);

/** Convert raw Ajv errors into structured {@link ValidationError}s. */
function toValidationErrors(
  errors: ErrorObject[] | null | undefined,
): ValidationError[] {
  if (!errors || errors.length === 0) {
    return [{ path: "/", message: "value did not match the schema" }];
  }
  return errors.map((error) => {
    const path = error.instancePath === "" ? "/" : error.instancePath;
    let message = error.message ?? "is invalid";
    // Surface the most useful parameter for the common keyword failures.
    if (
      error.keyword === "additionalProperties" &&
      typeof (error.params as { additionalProperty?: unknown })
        .additionalProperty === "string"
    ) {
      message += ` '${(error.params as { additionalProperty: string }).additionalProperty}'`;
    } else if (
      error.keyword === "enum" &&
      Array.isArray((error.params as { allowedValues?: unknown }).allowedValues)
    ) {
      message += `: ${JSON.stringify((error.params as { allowedValues: unknown[] }).allowedValues)}`;
    }
    return { path, message };
  });
}

/** Run a compiled validator and wrap the outcome in a {@link Result}. */
function runValidator<T>(
  validate: ValidateFunction<T>,
  data: unknown,
): Result<T, ValidationError[]> {
  if (validate(data)) {
    return ok(data);
  }
  return err(toValidationErrors(validate.errors));
}

/**
 * Validate an unknown value as a {@link LyricsJson} artifact (Req 15.4).
 * @returns the typed artifact on success, otherwise the structured errors.
 */
export function validateLyrics(
  data: unknown,
): Result<LyricsJson, ValidationError[]> {
  return runValidator(validateLyricsSchema, data);
}

/**
 * Validate an unknown value as an {@link AudioAnalysisJson} artifact (Req 15.4).
 * @returns the typed artifact on success, otherwise the structured errors.
 */
export function validateAudioAnalysis(
  data: unknown,
): Result<AudioAnalysisJson, ValidationError[]> {
  return runValidator(validateAudioAnalysisSchema, data);
}

/**
 * Validate an unknown value as a {@link ProjectConfigJson} artifact (Req 15.4).
 * @returns the typed artifact on success, otherwise the structured errors.
 */
export function validateProjectConfig(
  data: unknown,
): Result<ProjectConfigJson, ValidationError[]> {
  return runValidator(validateProjectConfigSchema, data);
}

/** Validate the canonical theme-first A-Z authoring map. */
export function validateLearningMap(
  data: unknown,
): Result<LearningMapJson, ValidationError[]> {
  return runValidator(validateLearningMapSchema, data);
}
