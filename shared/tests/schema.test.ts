import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SCHEMAS,
  SCHEMA_FILES,
  schemaDir,
  schemaPath,
  lyricsSchema,
  audioAnalysisSchema,
  projectConfigSchema,
} from "../src/schema/index.js";
import type {
  LyricsJson,
  AudioAnalysisJson,
  ProjectConfigJson,
} from "../src/types/index.js";

describe("shared artifact schemas (Req 15.4)", () => {
  it("exposes one schema per artifact with object shape", () => {
    expect(Object.keys(SCHEMAS).sort()).toEqual([
      "audioAnalysis",
      "lyrics",
      "projectConfig",
    ]);
    for (const schema of Object.values(SCHEMAS)) {
      expect(schema).toHaveProperty("type", "object");
      expect(schema).toHaveProperty("required");
      expect(Array.isArray((schema as { required: unknown }).required)).toBe(true);
    }
  });

  it("each in-memory schema matches its on-disk .json file (loadable from Python)", () => {
    for (const name of Object.keys(SCHEMA_FILES) as (keyof typeof SCHEMA_FILES)[]) {
      const onDisk = JSON.parse(readFileSync(schemaPath(name), "utf-8"));
      expect(onDisk).toEqual(SCHEMAS[name]);
    }
    expect(schemaDir()).toContain("schema");
  });

  it("lyrics schema requires the standardized line fields", () => {
    expect(lyricsSchema.required).toEqual(["version", "source", "lines"]);
    const lineDef = (lyricsSchema as any).$defs.lyricLine;
    expect(lineDef.required).toEqual(["start", "end", "text", "line1", "line2"]);
  });

  it("audio-analysis schema requires the time-series fields", () => {
    expect(audioAnalysisSchema.required).toContain("rms");
    expect(audioAnalysisSchema.required).toContain("beats");
    expect(audioAnalysisSchema.required).toContain("interval");
  });

  it("project-config schema requires assets and artifacts references", () => {
    expect(projectConfigSchema.required).toContain("assets");
    expect(projectConfigSchema.required).toContain("artifacts");
    expect(projectConfigSchema.required).toContain("layout");
  });

  it("types describe the canonical artifact objects", () => {
    const lyrics: LyricsJson = {
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
    const analysis: AudioAnalysisJson = {
      version: 1,
      duration: 2,
      interval: 0.5,
      sampleRate: 44100,
      rms: [0, 0.5, 1],
      bass: [0, 0.25, 0.75],
      bands: [[0, 1], [0.5, 0.5]],
      bandCount: 2,
      beats: [0.5, 1.5],
    };
    const config: ProjectConfigJson = {
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

    expect(lyrics.lines).toHaveLength(2);
    expect(analysis.bands).toHaveLength(2);
    expect(config.assets.letters.A).toContain("A.svg");
  });
});
