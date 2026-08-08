import { describe, expect, it } from "vitest";

import {
  validateLyrics,
  validateAudioAnalysis,
  validateProjectConfig,
  validateLearningMap,
  validateSongScript,
} from "../src/validate.js";
import type {
  LyricsJson,
  AudioAnalysisJson,
  ProjectConfigJson,
  LearningMapJson,
  SongScriptJson,
} from "../src/types/index.js";

const validLyrics: LyricsJson = {
  version: 1,
  source: "transcriber",
  lines: [
    { start: 0, end: 1, text: "hi", line1: "hi", line2: "" },
    {
      start: 1,
      end: 2,
      text: "world",
      line1: "world",
      line2: "",
      words: [{ text: "world", start: 1, end: 2 }],
      letter: "W",
    },
  ],
};

const validAnalysis: AudioAnalysisJson = {
  version: 1,
  duration: 2,
  interval: 0.5,
  sampleRate: 44100,
  rms: [0, 0.5, 1],
  bass: [0, 0.25, 0.75],
  bands: [
    [0, 1],
    [0.5, 0.5],
  ],
  bandCount: 2,
  beats: [0.5, 1.5],
};

const validMapping: LearningMapJson = {
  version: 1,
  revision: 3,
  state: "LOCKED",
  theme: {
    name: "Ocean",
    scope: "guided",
    mappingAuthority: "project-locked",
    ageBand: "mixed-2-6",
    mode: "LETTER_NAME",
  },
  letters: Object.fromEntries(
    [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => [letter, { object: `Object ${letter}` }]),
  ),
};

const validSongScript: SongScriptJson = {
  version: 1,
  mappingRevision: 3,
  lines: [
    {
      id: "r2-A",
      text: "A ... apple!",
      targetId: "A",
      objective: "retrieval-action",
      objectReveal: "target-word",
    },
  ],
};

const validConfig: ProjectConfigJson = {
  version: 1,
  projectId: "p1",
  metadata: { songName: "Song", singerName: "Singer" },
  videoFormat: "both",
  assets: {
    background: "assets/background.png",
    songLogo: "assets/song-logo.png",
    channelLogo: "assets/channel-logo.png",
    audio: "assets/audio.mp3",
    letters: { A: "assets/letters/A.svg" },
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

describe("shared validators (Req 15.4)", () => {
  it("accepts a well-formed lyrics artifact and returns the typed value", () => {
    const result = validateLyrics(validLyrics);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(validLyrics);
    }
  });

  it("accepts a well-formed audio-analysis artifact", () => {
    const result = validateAudioAnalysis(validAnalysis);
    expect(result.ok).toBe(true);
  });

  it("accepts a well-formed project-config artifact", () => {
    const result = validateProjectConfig(validConfig);
    expect(result.ok).toBe(true);
  });

  it("accepts a LOCKED mapping and matching structured song script", () => {
    expect(validateLearningMap(validMapping).ok).toBe(true);
    expect(validateSongScript(validSongScript).ok).toBe(true);
  });

  it("rejects a generated/unlocked value as canonical mapping", () => {
    expect(validateLearningMap({ ...validMapping, state: "PROPOSED" }).ok).toBe(false);
    expect(
      validateLearningMap({
        ...validMapping,
        theme: { ...validMapping.theme, mappingAuthority: "generated" },
      }).ok,
    ).toBe(false);
  });

  it("rejects lyrics with the wrong version and reports a structured error", () => {
    const result = validateLyrics({ ...validLyrics, version: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error[0]).toHaveProperty("path");
      expect(result.error[0]).toHaveProperty("message");
    }
  });

  it("rejects lyrics missing a required line field with a path to the offender", () => {
    const result = validateLyrics({
      version: 1,
      source: "transcriber",
      lines: [{ start: 0, end: 1, text: "hi", line1: "hi" }], // missing line2
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((e) => e.path.startsWith("/lines/0"))).toBe(true);
    }
  });

  it("rejects audio-analysis with out-of-range rms values", () => {
    const result = validateAudioAnalysis({ ...validAnalysis, rms: [1.5] });
    expect(result.ok).toBe(false);
  });

  it("rejects project-config with an unknown additional property", () => {
    const result = validateProjectConfig({ ...validConfig, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((e) => /additional/i.test(e.message))).toBe(true);
    }
  });

  it("rejects non-object input", () => {
    expect(validateLyrics(null).ok).toBe(false);
    expect(validateAudioAnalysis("nope").ok).toBe(false);
    expect(validateProjectConfig(42).ok).toBe(false);
  });
});
