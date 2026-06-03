import { describe, expect, it } from "vitest";
import type {
  AudioAnalysisJson,
  LyricLine,
  LyricsJson,
} from "@music-visualizer/shared";
import {
  activeLineIndex,
  backgroundDynamics,
  barHeights,
  beatPulse,
  letterScale,
  litWordCount,
  sampleBands,
  sampleSeries,
} from "../src/selectors.js";

const lyrics: LyricsJson = {
  version: 1,
  source: "transcriber",
  lines: [
    { start: 0, end: 2, text: "one", line1: "one", line2: "" },
    { start: 3, end: 5, text: "two", line1: "two", line2: "" },
  ],
};

const analysis: AudioAnalysisJson = {
  version: 1,
  duration: 1,
  interval: 0.5,
  sampleRate: 44100,
  rms: [0.1, 0.5, 0.9],
  bass: [0, 0.4, 0.8],
  bands: [
    [0, 0.2],
    [0.5, 0.6],
  ],
  bandCount: 2,
  beats: [1, 2, 3],
};

describe("activeLineIndex", () => {
  it("returns the index of the line containing t", () => {
    expect(activeLineIndex(lyrics, 1)).toBe(0);
    expect(activeLineIndex(lyrics, 4)).toBe(1);
  });

  it("returns -1 when no line is active", () => {
    expect(activeLineIndex(lyrics, 2.5)).toBe(-1);
    expect(activeLineIndex(lyrics, 10)).toBe(-1);
  });
});

describe("litWordCount", () => {
  const line: LyricLine = {
    start: 0,
    end: 3,
    text: "a b c",
    line1: "a b c",
    line2: "",
    words: [
      { text: "a", start: 0, end: 1 },
      { text: "b", start: 1, end: 2 },
      { text: "c", start: 2, end: 3 },
    ],
  };

  it("counts words whose start <= t", () => {
    expect(litWordCount(line, -1)).toBe(0);
    expect(litWordCount(line, 0)).toBe(1);
    expect(litWordCount(line, 1.5)).toBe(2);
    expect(litWordCount(line, 5)).toBe(3);
  });

  it("lights the whole line once started when there is no word timing", () => {
    const noWords: LyricLine = { start: 2, end: 4, text: "x", line1: "x", line2: "" };
    expect(litWordCount(noWords, 1)).toBe(0);
    expect(litWordCount(noWords, 3)).toBe(Infinity);
  });
});

describe("sampleSeries", () => {
  it("samples at clamp(floor(t / interval))", () => {
    expect(sampleSeries(analysis.rms, analysis.interval, 0)).toBe(0.1);
    expect(sampleSeries(analysis.rms, analysis.interval, 0.5)).toBe(0.5);
    expect(sampleSeries(analysis.rms, analysis.interval, 1.0)).toBe(0.9);
  });

  it("clamps out-of-range and negative times", () => {
    expect(sampleSeries(analysis.rms, analysis.interval, 100)).toBe(0.9);
    expect(sampleSeries(analysis.rms, analysis.interval, -5)).toBe(0.1);
  });

  it("returns 0 for an empty series", () => {
    expect(sampleSeries([], 0.5, 1)).toBe(0);
  });
});

describe("sampleBands", () => {
  it("returns the band vector active at t", () => {
    expect(sampleBands(analysis, 0)).toEqual([0, 0.2]);
    expect(sampleBands(analysis, 0.5)).toEqual([0.5, 0.6]);
    expect(sampleBands(analysis, 100)).toEqual([0.5, 0.6]);
  });
});

describe("beatPulse", () => {
  it("is 1 on a beat and decays to 0 at the window edge", () => {
    expect(beatPulse(analysis.beats, 1, 0.5)).toBe(1);
    expect(beatPulse(analysis.beats, 1.25, 0.5)).toBeCloseTo(0.5);
    expect(beatPulse(analysis.beats, 1.5, 0.5)).toBe(0);
  });

  it("is 0 when no beat is within the window or list is empty", () => {
    expect(beatPulse(analysis.beats, 10, 0.5)).toBe(0);
    expect(beatPulse([], 1, 0.5)).toBe(0);
  });
});

describe("backgroundDynamics", () => {
  it("is bounded and monotonic in rms", () => {
    expect(backgroundDynamics(0)).toEqual({ scale: 1, brightness: 0.7 });
    expect(backgroundDynamics(1)).toEqual({ scale: 1.08, brightness: 1.0 });
  });

  it("clamps out-of-range rms", () => {
    expect(backgroundDynamics(5)).toEqual({ scale: 1.08, brightness: 1.0 });
    expect(backgroundDynamics(-5)).toEqual({ scale: 1, brightness: 0.7 });
  });
});

describe("letterScale", () => {
  it("is bounded to [1, 1.4] and non-decreasing in inputs", () => {
    expect(letterScale(0, 0)).toBe(1);
    expect(letterScale(1, 1)).toBeCloseTo(1.4);
    expect(letterScale(5, 5)).toBeCloseTo(1.4);
  });
});

describe("barHeights", () => {
  it("keeps every height within [0, maxHeight]", () => {
    const heights = barHeights([0, 0.5, 1], 1, 200);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(200);
    }
  });

  it("clamps adversarial band/volume values", () => {
    const heights = barHeights([-5, 5], 10, 100);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(100);
    }
  });
});
