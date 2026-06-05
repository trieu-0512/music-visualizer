import { describe, expect, it } from "vitest";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "@music-visualizer/shared";

import { buildOpenReelEffectsManifest } from "../src/handoff/effects.js";
import {
  buildHtmlVideoStoryboard,
  expandStoryboardTargets,
} from "../src/handoff/storyboard.js";

const letters: Record<string, string> = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return [letter, `assets/letters/${letter}.png`];
  }),
);

const config: ProjectConfigJson = {
  version: 1,
  projectId: "abc-test",
  metadata: { songName: "ABC Test", singerName: "Kids Choir" },
  videoFormat: "both",
  assets: {
    background: "assets/background.png",
    songLogo: "assets/song-logo.png",
    channelLogo: "assets/channel-logo.png",
    audio: "assets/audio.wav",
    letters,
  },
  artifacts: {
    lyrics: "artifacts/lyrics.json",
    audioAnalysis: "artifacts/audio-analysis.json",
  },
  layout: {
    template: "classic-landscape",
    lyricBox: { maxLines: 2 },
    bars: { left: true, right: true },
  },
};

const lyrics: LyricsJson = {
  version: 1,
  source: "original+transcriber",
  lines: [
    {
      start: 0,
      end: 2,
      text: "A is for apple.",
      line1: "A is for",
      line2: "apple.",
      letter: "A",
      words: [
        { text: "A", start: 0, end: 0.3 },
        { text: "is", start: 0.35, end: 0.6 },
        { text: "for", start: 0.65, end: 1 },
        { text: "apple", start: 1.1, end: 1.8 },
      ],
    },
    {
      start: 2.5,
      end: 4,
      text: "B is for book.",
      line1: "B is for book.",
      line2: "",
      letter: "B",
    },
  ],
};

const analysis: AudioAnalysisJson = {
  version: 1,
  duration: 5,
  interval: 1,
  sampleRate: 48000,
  rms: [0.1, 0.5, 0.9, 0.4, 0.2],
  bass: [0.2, 0.7, 0.3, 0.6, 0.1],
  bands: [
    [0.1, 0.2],
    [0.5, 0.6],
    [0.9, 0.1],
  ],
  bandCount: 2,
  beats: [0.5, 1.5, 3.25],
};

describe("html-video handoff storyboard", () => {
  it("expands the requested video format into html-video output targets", () => {
    expect(expandStoryboardTargets("landscape").map((t) => t.id)).toEqual([
      "landscape-fullhd",
    ]);
    expect(expandStoryboardTargets("portrait").map((t) => t.id)).toEqual([
      "portrait-fullhd",
    ]);
    expect(expandStoryboardTargets("both").map((t) => t.id)).toEqual([
      "landscape-fullhd",
      "portrait-fullhd",
    ]);
  });

  it("converts canonical artifacts into timed scenes with effect cues", () => {
    const storyboard = buildHtmlVideoStoryboard(config, lyrics, analysis);

    expect(storyboard.renderer).toBe("html-video");
    expect(storyboard.duration).toBe(5);
    expect(storyboard.project).toMatchObject({
      id: "abc-test",
      songName: "ABC Test",
      videoFormat: "both",
    });
    expect(storyboard.scenes).toHaveLength(2);
    expect(storyboard.scenes[0]).toMatchObject({
      id: "scene-0001-A",
      rows: ["A is for", "apple."],
      letter: "A",
      letterAsset: "assets/letters/A.png",
      audio: {
        beatCount: 2,
      },
    });
    expect(storyboard.scenes[0]?.words).toHaveLength(4);
    expect(storyboard.scenes[0]?.effects.map((cue) => cue.id)).toEqual([
      "background-audio-breathe",
      "beat-letter-pop",
      "karaoke-word-highlight",
      "side-audio-bars",
      "scene-soft-crossfade",
    ]);
  });
});

describe("OpenReel effects manifest", () => {
  it("documents OpenReel as reference-only instead of a runtime dependency", () => {
    const manifest = buildOpenReelEffectsManifest();

    expect(manifest.source).toBe("openreel-video");
    expect(manifest.usage).toBe("reference-only");
    expect(manifest.effects.map((effect) => effect.id)).toContain(
      "beat-letter-pop",
    );
  });
});
