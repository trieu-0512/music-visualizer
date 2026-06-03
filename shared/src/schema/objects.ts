/**
 * Browser-safe JSON Schema objects for the canonical artifacts.
 *
 * Path helpers that require Node built-ins live in `schema/index.ts`; browser
 * consumers should import schema objects through this module or the package
 * root.
 */
import lyricsSchema from "./lyrics.schema.json" with { type: "json" };
import audioAnalysisSchema from "./audio-analysis.schema.json" with { type: "json" };
import projectConfigSchema from "./project-config.schema.json" with { type: "json" };

export { lyricsSchema, audioAnalysisSchema, projectConfigSchema };

/** Map of artifact name -> JSON Schema object. */
export const SCHEMAS = {
  lyrics: lyricsSchema,
  audioAnalysis: audioAnalysisSchema,
  projectConfig: projectConfigSchema,
} as const;

/** File names of the schemas as stored on disk (loadable from Python). */
export const SCHEMA_FILES = {
  lyrics: "lyrics.schema.json",
  audioAnalysis: "audio-analysis.schema.json",
  projectConfig: "project-config.schema.json",
} as const;
