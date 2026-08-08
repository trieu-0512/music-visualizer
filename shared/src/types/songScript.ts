/** Structured authoring script consumed by alignment and visual timing. */
export type LearningObjective =
  | "narration"
  | "lexical-semantic"
  | "verbatim"
  | "retrieval-action"
  | "phonics";

export type ObjectRevealPolicy = "line-start" | "target-word" | "line-end" | "none";

export interface SongScriptLine {
  /** Stable authoring identity; survives text/timing enrichment. */
  id: string;
  sectionId?: string;
  text: string;
  /** Canonical A-Z mapping key; absent on chorus/narration lines. */
  targetId?: string;
  objective: LearningObjective;
  /** Defaults by objective when omitted: retrieval-action -> target-word, otherwise line-start. */
  objectReveal?: ObjectRevealPolicy;
}

export interface SongScriptJson {
  version: 1;
  /** Must equal authoring/mapping.json revision. */
  mappingRevision: number;
  lines: SongScriptLine[];
}
