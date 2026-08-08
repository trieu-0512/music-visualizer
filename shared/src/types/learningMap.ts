/** Canonical authoring map that locks one object to each A-Z learning target. */
export type ThemeScope = "strict" | "guided" | "open";
export type MappingAuthority = "user-locked" | "project-locked";
export type MappingState = "LOCKED";
export type LearningMode = "LETTER_NAME" | "PHONICS";
export type AgeBand = "2-3" | "4-6" | "mixed-2-6";

export interface LearningMapEntry {
  object: string;
  /** Optional stable slug for filenames/UI. Render identity remains the letter key. */
  slug?: string;
  familiarityTier?: "A" | "B" | "C";
  action?: string;
  visualHint?: string;
  riskFlags?: string[];
}

export interface LearningMapJson {
  version: 1;
  /** Monotonic authoring revision. Any mapping change must increment it. */
  revision: number;
  /** Canonical runtime mapping.json is only valid after the human/agent lock gate. */
  state: MappingState;
  theme: {
    name: string;
    scope: ThemeScope;
    mappingAuthority: MappingAuthority;
    ageBand: AgeBand;
    mode: LearningMode;
  };
  /** Exactly A-Z. The key is the stable runtime asset identity. */
  letters: Record<string, LearningMapEntry>;
}
