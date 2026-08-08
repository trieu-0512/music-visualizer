/**
 * Artifact validators built directly from the canonical JSON Schemas in
 * shared/src/schema so Node/browser and Python workers share one contract.
 */
import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";

import { err, ok, type Result } from "./result.js";
import {
  audioAnalysisSchema,
  lyricsSchema,
  projectConfigSchema,
  learningMapSchema,
  songScriptSchema,
} from "./schema/objects.js";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
  LearningMapJson,
  SongScriptJson,
} from "./types/index.js";

export interface ValidationError {
  path: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });

const validateLyricsSchema: ValidateFunction<LyricsJson> =
  ajv.compile<LyricsJson>(lyricsSchema);
const validateAudioAnalysisSchema: ValidateFunction<AudioAnalysisJson> =
  ajv.compile<AudioAnalysisJson>(audioAnalysisSchema);
const validateProjectConfigSchema: ValidateFunction<ProjectConfigJson> =
  ajv.compile<ProjectConfigJson>(projectConfigSchema);
const validateLearningMapSchema: ValidateFunction<LearningMapJson> =
  ajv.compile<LearningMapJson>(learningMapSchema);
const validateSongScriptSchema: ValidateFunction<SongScriptJson> =
  ajv.compile<SongScriptJson>(songScriptSchema);

function toValidationErrors(
  errors: ErrorObject[] | null | undefined,
): ValidationError[] {
  if (!errors || errors.length === 0) {
    return [{ path: "/", message: "value did not match the schema" }];
  }
  return errors.map((error) => {
    const path = error.instancePath === "" ? "/" : error.instancePath;
    let message = error.message ?? "is invalid";
    if (
      error.keyword === "additionalProperties" &&
      typeof (error.params as { additionalProperty?: unknown }).additionalProperty === "string"
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

function runValidator<T>(
  validate: ValidateFunction<T>,
  data: unknown,
): Result<T, ValidationError[]> {
  if (validate(data)) return ok(data);
  return err(toValidationErrors(validate.errors));
}

export function validateLyrics(
  data: unknown,
): Result<LyricsJson, ValidationError[]> {
  return runValidator(validateLyricsSchema, data);
}

export function validateAudioAnalysis(
  data: unknown,
): Result<AudioAnalysisJson, ValidationError[]> {
  return runValidator(validateAudioAnalysisSchema, data);
}

export function validateProjectConfig(
  data: unknown,
): Result<ProjectConfigJson, ValidationError[]> {
  return runValidator(validateProjectConfigSchema, data);
}

/** Canonical mapping.json is production-authoritative only after LOCKED. */
export function validateLearningMap(
  data: unknown,
): Result<LearningMapJson, ValidationError[]> {
  return runValidator(validateLearningMapSchema, data);
}

/** Structured authoring script used by alignment and visual reveal timing. */
export function validateSongScript(
  data: unknown,
): Result<SongScriptJson, ValidationError[]> {
  return runValidator(validateSongScriptSchema, data);
}
