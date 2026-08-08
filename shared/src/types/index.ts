/**
 * Barrel for the canonical artifact types consumed across all areas (Req 15.4).
 */
export type { WordTiming, LyricLine, LyricsJson } from "./lyrics.js";
export type { AudioAnalysisJson } from "./audioAnalysis.js";
export type {
  ThemeScope,
  MappingAuthority,
  LearningMode,
  AgeBand,
  LearningMapEntry,
  LearningMapJson,
} from "./learningMap.js";
export type {
  VideoFormat,
  AssetPaths,
  LayoutDefinition,
  ProjectConfigJson,
} from "./projectConfig.js";
