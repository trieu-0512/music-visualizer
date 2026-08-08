/**
 * Browser-safe JSON Schema objects for the canonical artifacts.
 *
 * Path helpers that require Node built-ins live in `schema/index.ts`; browser
 * consumers should import schema objects through this module or the package root.
 */
import lyricsSchema from "./lyrics.schema.json" with { type: "json" };
import audioAnalysisSchema from "./audio-analysis.schema.json" with { type: "json" };
import projectConfigSchema from "./project-config.schema.json" with { type: "json" };
import learningMapSchema from "./learning-map.schema.json" with { type: "json" };
import songScriptSchema from "./song-script.schema.json" with { type: "json" };

export {
  lyricsSchema,
  audioAnalysisSchema,
  projectConfigSchema,
  learningMapSchema,
  songScriptSchema,
};

/** Map of artifact name -> JSON Schema object. */
export const SCHEMAS = {
  lyrics: lyricsSchema,
  audioAnalysis: audioAnalysisSchema,
  projectConfig: projectConfigSchema,
  learningMap: learningMapSchema,
  songScript: songScriptSchema,
} as const;

/** File names of the schemas as stored on disk (loadable from Python). */
export const SCHEMA_FILES = {
  lyrics: "lyrics.schema.json",
  audioAnalysis: "audio-analysis.schema.json",
  projectConfig: "project-config.schema.json",
  learningMap: "learning-map.schema.json",
  songScript: "song-script.schema.json",
} as const;
