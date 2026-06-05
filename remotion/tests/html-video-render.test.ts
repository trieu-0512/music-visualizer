import { describe, expect, it } from "vitest";
import type { HtmlVideoStoryboard } from "../src/handoff/storyboard.js";
import {
  buildHtmlVideoDocument,
  projectAssetUrl,
} from "../src/html-video-render/template.js";

const storyboard: HtmlVideoStoryboard = {
  version: 1,
  renderer: "html-video",
  source: "music-visualizer",
  fps: 60,
  duration: 3,
  project: {
    id: "p1",
    songName: "ABC Song",
    singerName: "Kids Choir",
    videoFormat: "landscape",
  },
  assets: {
    background: "assets/background.png",
    songLogo: "assets/song-logo.png",
    channelLogo: "assets/channel-logo.png",
    audio: "assets/audio.mp3",
    letters: { A: "assets/letters/A.png" },
  },
  outputTargets: [
    {
      id: "landscape-fullhd",
      format: "landscape",
      width: 1920,
      height: 1080,
      fps: 60,
      fileName: "html-video-16x9-fullhd-60fps.mp4",
    },
  ],
  scenes: [
    {
      id: "scene-0001-A",
      index: 0,
      start: 0,
      end: 3,
      duration: 3,
      text: "A is for apple.",
      rows: ["A is for apple."],
      letter: "A",
      letterAsset: "assets/letters/A.png",
      words: [{ text: "A", start: 0, end: 0.4 }],
      audio: { averageRms: 0.5, averageBass: 0.3, beatCount: 1 },
      effects: [],
    },
  ],
  effectReferences: [],
};

describe("html-video render template", () => {
  it("generates a self-contained browser timeline using project file URLs", () => {
    const target = storyboard.outputTargets[0];
    expect(target).toBeDefined();
    const html = buildHtmlVideoDocument(storyboard, target!, {
      projectDir: "F:/MMO/Nhac/music-visualizer/storage/projects/p1",
      duration: 2,
    });

    expect(html).toContain("const STORYBOARD =");
    expect(html).toContain("ABC Song");
    expect(html).toContain("file:///F:/MMO/Nhac/music-visualizer/storage/projects/p1/assets/background.png");
    expect(html).toContain("scene-0001-A");
    expect(html).toContain('"duration":2');
    expect(html).toContain("window.__MV_READY__");
    expect(html).toContain("window.__MV_RENDER_AT__");
    expect(html).toContain("frame-render");
  });

  it("converts project-relative assets to file URLs", () => {
    expect(projectAssetUrl("F:/Project", "assets/audio.mp3")).toBe(
      "file:///F:/Project/assets/audio.mp3",
    );
  });
});
