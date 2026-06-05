/**
 * OpenReel is used here as an effects reference only. The generated manifests
 * describe which effects to port into our render templates; they do not require
 * the OpenReel runtime, project schema, or browser editor export path.
 */

export type EffectPortTarget =
  | "background"
  | "letter"
  | "lyrics"
  | "audio-bars"
  | "scene";

export interface OpenReelEffectReference {
  id:
    | "background-audio-breathe"
    | "beat-letter-pop"
    | "karaoke-word-highlight"
    | "side-audio-bars"
    | "scene-soft-crossfade";
  target: EffectPortTarget;
  openReelArea: string;
  description: string;
  portStrategy: string;
}

export interface OpenReelEffectsManifest {
  version: 1;
  source: "openreel-video";
  usage: "reference-only";
  generatedFor: "music-visualizer";
  effects: OpenReelEffectReference[];
}

export const OPENREEL_EFFECT_REFERENCES: readonly OpenReelEffectReference[] = [
  {
    id: "background-audio-breathe",
    target: "background",
    openReelArea: "render bridge / effects bridge",
    description: "Subtle zoom and brightness movement driven by RMS volume.",
    portStrategy:
      "Map per-scene RMS to CSS transform scale and brightness filters in the html-video template.",
  },
  {
    id: "beat-letter-pop",
    target: "letter",
    openReelArea: "beat sync bridge / animation engine",
    description: "Letter/object foreground pops on nearby beat events.",
    portStrategy:
      "Use beat timestamps and bass energy to keyframe scale, glow, and easing for the active letter asset.",
  },
  {
    id: "karaoke-word-highlight",
    target: "lyrics",
    openReelArea: "audio text sync bridge / text bridge",
    description: "Progressive word highlighting from word-level lyric timing.",
    portStrategy:
      "Emit word timing into the storyboard and let the html-video scene template color words by current time.",
  },
  {
    id: "side-audio-bars",
    target: "audio-bars",
    openReelArea: "audio bridge / graphics bridge",
    description: "Mirrored side bars reacting to band energy and overall volume.",
    portStrategy:
      "Sample band energy from audio-analysis.json and render CSS/canvas bars in the template.",
  },
  {
    id: "scene-soft-crossfade",
    target: "scene",
    openReelArea: "transition bridge",
    description: "Short fade between active lyric scenes to avoid hard visual jumps.",
    portStrategy:
      "Apply a short opacity overlap between neighboring lyric scenes, clamped to scene duration.",
  },
] as const;

export function buildOpenReelEffectsManifest(): OpenReelEffectsManifest {
  return {
    version: 1,
    source: "openreel-video",
    usage: "reference-only",
    generatedFor: "music-visualizer",
    effects: [...OPENREEL_EFFECT_REFERENCES],
  };
}
