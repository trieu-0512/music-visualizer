/**
 * Types for the standardized lyric artifact `lyrics.json`.
 */
import type { LearningObjective } from "./songScript.js";

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface LyricLine {
  start: number;
  end: number;
  text: string;
  line1: string;
  line2: string;
  words?: WordTiming[];
  /** Stable line identity copied from authoring/song-script.json. */
  id?: string;
  /** Canonical A-Z learning target identity. */
  targetId?: string;
  objective?: LearningObjective;
  /** Backward-compatible resolved A-Z asset key. */
  letter?: string;
  /** Canonical object name copied from the locked mapping. */
  object?: string;
  /** Absolute audio time when the object answer may become visible. */
  objectRevealAt?: number;
  /** Text/timing agreement proxy, 0..1. */
  alignmentConfidence?: number;
}

export interface LyricsJson {
  version: 1;
  source: "transcriber" | "original+transcriber" | "original+lrc";
  lines: LyricLine[];
  provenance?: {
    audioSha256: string;
    transcriptSha256?: string;
    transcriptPath?: string;
    mappingRevision?: number;
    songScriptMappingRevision?: number;
  };
  /** Alignment diagnostics are explicit so count/text mismatches cannot hide behind schema validity. */
  alignment?: {
    mode: "asr-only" | "canonical-order" | "lrc-canonical";
    status: "clean" | "review-required";
    canonicalLineCount: number;
    segmentCount: number;
    averageTextSimilarity?: number;
  };
}
