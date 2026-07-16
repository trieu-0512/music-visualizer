/**
 * Unit tests for the headless render orchestration (task 10.4).
 *
 * These cover the Chromium-free parts: format -> target expansion, output
 * naming/resolution/storage paths, the asset inventory, and `renderProject`'s
 * orchestration (staging -> bundle -> select -> render -> store) driven through
 * a fake {@link RenderBackend} so no browser is launched. The real
 * Chromium + FFmpeg render is covered by the integration test (task 10.5).
 */
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "@music-visualizer/shared";
import {
  LANDSCAPE_TARGET,
  LANDSCAPE_TARGETS,
  PORTRAIT_TARGET,
  PORTRAIT_TARGETS,
  RenderError,
  collectAssetPaths,
  expandRenderTargets,
  filterRenderTargets,
  renderProject,
  type AssetRef,
  type RenderAssetStore,
  type RenderBackend,
  type RemotionRenderSettings,
} from "../src/render.js";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function makeConfig(
  videoFormat: ProjectConfigJson["videoFormat"],
): ProjectConfigJson {
  return {
    version: 1,
    projectId: "p_test",
    metadata: { songName: "Song", singerName: "Singer" },
    videoFormat,
    assets: {
      background: "assets/background.jpg",
      songLogo: "assets/song-logo.png",
      channelLogo: "assets/channel-logo.png",
      audio: "assets/audio.mp3",
      letters: Object.fromEntries(
        LETTERS.map((l) => [l, `assets/letters/${l}.svg`]),
      ),
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
}

const lyrics: LyricsJson = {
  version: 1,
  source: "transcriber",
  lines: [{ start: 0, end: 2, text: "hello", line1: "hello", line2: "" }],
};

const analysis: AudioAnalysisJson = {
  version: 1,
  duration: 2,
  interval: 0.5,
  sampleRate: 44100,
  rms: [0.1, 0.2],
  bass: [0.1, 0.2],
  bands: [[0.1], [0.2]],
  bandCount: 1,
  beats: [1],
};

/**
 * In-memory {@link RenderAssetStore} seeded with the artifacts a render reads
 * and any asset bytes. Records writes so tests can assert produced outputs.
 */
function makeStore(seed: Record<string, Buffer> = {}): RenderAssetStore & {
  files: Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>(Object.entries(seed));
  const key = (ref: AssetRef) => `${ref.projectId}/${ref.relativePath}`;
  return {
    files,
    async read(ref) {
      const value = files.get(key(ref));
      if (!value) throw new Error(`not found: ${key(ref)}`);
      return value;
    },
    async write(ref, data) {
      files.set(key(ref), data);
    },
    async delete(ref) {
      files.delete(key(ref));
    },
    async exists(ref) {
      return files.has(key(ref));
    },
  };
}

/** Seed every artifact + asset a render reads so staging/loading succeed. */
function seedFor(config: ProjectConfigJson): Record<string, Buffer> {
  const seed: Record<string, Buffer> = {
    [`${config.projectId}/${config.artifacts.lyrics}`]: Buffer.from(
      JSON.stringify(lyrics),
    ),
    [`${config.projectId}/${config.artifacts.audioAnalysis}`]: Buffer.from(
      JSON.stringify(analysis),
    ),
  };
  for (const path of collectAssetPaths(config.assets)) {
    seed[`${config.projectId}/${path}`] = Buffer.from(`bytes:${path}`);
  }
  return seed;
}

/**
 * Fake {@link RenderBackend} that records calls and writes a placeholder MP4 to
 * the requested output location so `renderProject` can read + store it.
 */
function makeBackend(): RenderBackend & {
  calls: {
    bundle: number;
    select: string[];
    render: string[];
    renderSettings: RemotionRenderSettings[];
  };
} {
  const calls = {
    bundle: 0,
    select: [] as string[],
    render: [] as string[],
    renderSettings: [] as RemotionRenderSettings[],
  };
  return {
    calls,
    async bundle() {
      calls.bundle += 1;
      return "serve://bundle";
    },
    async selectComposition(options) {
      calls.select.push(options.id);
      return { id: options.id };
    },
    async renderMedia(options) {
      calls.render.push(options.outputLocation);
      calls.renderSettings.push({
        crf: options.crf,
        videoBitrate: options.videoBitrate,
        encodingMaxRate: options.encodingMaxRate,
        encodingBufferSize: options.encodingBufferSize,
        x264Preset: options.x264Preset,
        concurrency: options.concurrency,
        audioBitrate: options.audioBitrate,
      });
      const { writeFile } = await import("node:fs/promises");
      await writeFile(options.outputLocation, Buffer.from(`video:${options.outputLocation}`));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* expandRenderTargets (Req 9.2, 9.3)                                         */
/* -------------------------------------------------------------------------- */

describe("expandRenderTargets (Req 9.2, 9.3)", () => {
  it("maps landscape to Full HD, 2K, and 4K landscape targets", () => {
    expect(expandRenderTargets("landscape")).toEqual([...LANDSCAPE_TARGETS]);
    expect(LANDSCAPE_TARGET).toMatchObject({
      compositionId: "landscape-fullhd",
      fileName: "final-16x9-fullhd-60fps.mp4",
      relativePath: "artifacts/final-16x9-fullhd-60fps.mp4",
      width: 1920,
      height: 1080,
    });
    expect(LANDSCAPE_TARGETS.map((target) => target.fileName)).toEqual([
      "final-16x9-fullhd-60fps.mp4",
      "final-16x9-2k-60fps.mp4",
      "final-16x9-4k-60fps.mp4",
    ]);
  });

  it("maps portrait to Full HD, 2K, and 4K portrait targets", () => {
    expect(expandRenderTargets("portrait")).toEqual([...PORTRAIT_TARGETS]);
    expect(PORTRAIT_TARGET).toMatchObject({
      compositionId: "portrait-fullhd",
      fileName: "final-9x16-fullhd-60fps.mp4",
      relativePath: "artifacts/final-9x16-fullhd-60fps.mp4",
      width: 1080,
      height: 1920,
    });
    expect(PORTRAIT_TARGETS.map((target) => target.fileName)).toEqual([
      "final-9x16-fullhd-60fps.mp4",
      "final-9x16-2k-60fps.mp4",
      "final-9x16-4k-60fps.mp4",
    ]);
  });

  it("maps both to all landscape targets then all portrait targets", () => {
    expect(expandRenderTargets("both")).toEqual([
      ...LANDSCAPE_TARGETS,
      ...PORTRAIT_TARGETS,
    ]);
  });

  it("filters targets by quality or explicit composition id", () => {
    expect(filterRenderTargets(LANDSCAPE_TARGETS, ["fullhd"])).toEqual([
      LANDSCAPE_TARGET,
    ]);
    expect(filterRenderTargets(LANDSCAPE_TARGETS, ["landscape-4k"])).toEqual([
      LANDSCAPE_TARGETS[2],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* collectAssetPaths                                                          */
/* -------------------------------------------------------------------------- */

describe("collectAssetPaths", () => {
  it("includes background, both logos, audio, and all 26 letters", () => {
    const paths = collectAssetPaths(makeConfig("both").assets);
    expect(paths).toContain("assets/background.jpg");
    expect(paths).toContain("assets/song-logo.png");
    expect(paths).toContain("assets/channel-logo.png");
    expect(paths).toContain("assets/audio.mp3");
    for (const l of LETTERS) {
      expect(paths).toContain(`assets/letters/${l}.svg`);
    }
    // 4 named assets + 26 letters, de-duplicated.
    expect(paths).toHaveLength(30);
  });

  it("de-duplicates repeated paths", () => {
    const assets = makeConfig("landscape").assets;
    assets.songLogo = assets.channelLogo; // same file in two roles
    const paths = collectAssetPaths(assets);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

/* -------------------------------------------------------------------------- */
/* renderProject orchestration (Req 9.2, 9.3, 9.4, 9.6)                       */
/* -------------------------------------------------------------------------- */

describe("renderProject", () => {
  it("renders all landscape outputs and stores them under the project", async () => {
    const config = makeConfig("landscape");
    const store = makeStore(seedFor(config));
    const backend = makeBackend();

    const produced = await renderProject(config, store, {
      backend,
      entryPoint: "/fake/index.js",
    });

    expect(produced).toEqual(LANDSCAPE_TARGETS.map((target) => target.relativePath));
    expect(backend.calls.select).toEqual(
      LANDSCAPE_TARGETS.map((target) => target.compositionId),
    );
    for (const target of LANDSCAPE_TARGETS) {
      expect(store.files.has(`p_test/${target.relativePath}`)).toBe(true);
    }
  });

  it("honors videoFormatOverride over config.videoFormat and clears prior finals", async () => {
    const config = makeConfig("both");
    const store = makeStore(seedFor(config));
    // Stale portrait artifact from a prior both-render.
    store.files.set(
      "p_test/artifacts/final-9x16-fullhd-60fps.mp4",
      Buffer.from("stale"),
    );
    const backend = makeBackend();

    const produced = await renderProject(config, store, {
      backend,
      entryPoint: "/fake/index.js",
      videoFormatOverride: "landscape",
    });

    expect(produced).toEqual(LANDSCAPE_TARGETS.map((target) => target.relativePath));
    expect(backend.calls.select).toEqual(
      LANDSCAPE_TARGETS.map((target) => target.compositionId),
    );
    // Prior portrait final was cleared; only landscape outputs remain.
    expect(store.files.has("p_test/artifacts/final-9x16-fullhd-60fps.mp4")).toBe(false);
  });

  it("can render one selected target with custom Remotion quality settings", async () => {
    const config = makeConfig("landscape");
    const store = makeStore(seedFor(config));
    const backend = makeBackend();

    const produced = await renderProject(config, store, {
      backend,
      entryPoint: "/fake/index.js",
      targetSelectors: ["landscape-fullhd"],
      renderSettings: {
        crf: 10,
        x264Preset: "slow",
        concurrency: 2,
        audioBitrate: "256k",
      },
    });

    expect(produced).toEqual([LANDSCAPE_TARGET.relativePath]);
    expect(backend.calls.select).toEqual([LANDSCAPE_TARGET.compositionId]);
    expect(backend.calls.renderSettings).toEqual([
      {
        crf: 10,
        videoBitrate: undefined,
        encodingMaxRate: undefined,
        encodingBufferSize: undefined,
        x264Preset: "slow",
        concurrency: 2,
        audioBitrate: "256k",
      },
    ]);
  });

  it("renders all six outputs in order with the correct composition ids", async () => {
    const config = makeConfig("both");
    const store = makeStore(seedFor(config));
    const backend = makeBackend();

    const produced = await renderProject(config, store, {
      backend,
      entryPoint: "/fake/index.js",
    });

    const targets = [...LANDSCAPE_TARGETS, ...PORTRAIT_TARGETS];
    expect(produced).toEqual(targets.map((target) => target.relativePath));
    expect(backend.calls.bundle).toBe(1);
    expect(backend.calls.select).toEqual(targets.map((target) => target.compositionId));
    for (const target of targets) {
      expect(store.files.has(`p_test/${target.relativePath}`)).toBe(true);
    }
  });

  it("passes config/lyrics/analysis as input props to the composition", async () => {
    const config = makeConfig("landscape");
    const store = makeStore(seedFor(config));
    let captured: Record<string, unknown> | undefined;
    const backend: RenderBackend = {
      async bundle() {
        return "serve://bundle";
      },
      async selectComposition(options) {
        captured = options.inputProps;
        return {};
      },
      async renderMedia(options) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(options.outputLocation, Buffer.from("video"));
      },
    };

    await renderProject(config, store, { backend, entryPoint: "/fake/index.js" });

    expect(captured).toBeDefined();
    expect(captured).toMatchObject({ config, lyrics, analysis });
  });

  it("stages assets into a public dir for the bundle", async () => {
    const config = makeConfig("landscape");
    const store = makeStore(seedFor(config));
    let stagedBackground: Buffer | undefined;
    const backend: RenderBackend = {
      async bundle(options) {
        expect(options.publicDir).toBeTruthy();
        stagedBackground = await readFile(
          join(options.publicDir as string, "assets", "background.jpg"),
        );
        return "serve://bundle";
      },
      async selectComposition() {
        return {};
      },
      async renderMedia(options) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(options.outputLocation, Buffer.from("video"));
      },
    };

    await renderProject(config, store, { backend, entryPoint: "/fake/index.js" });

    expect(stagedBackground?.toString()).toBe("bytes:assets/background.jpg");
  });

  it("wraps a backend failure in a RenderError describing the failed output (Req 9.6)", async () => {
    const config = makeConfig("portrait");
    const store = makeStore(seedFor(config));
    const backend: RenderBackend = {
      async bundle() {
        return "serve://bundle";
      },
      async selectComposition() {
        return {};
      },
      async renderMedia() {
        throw new Error("chromium crashed");
      },
    };

    await expect(
      renderProject(config, store, { backend, entryPoint: "/fake/index.js" }),
    ).rejects.toThrowError(RenderError);
    await expect(
      renderProject(config, store, { backend, entryPoint: "/fake/index.js" }),
    ).rejects.toThrow(/final-9x16-fullhd-60fps\.mp4/);
  });

  it("fails with a RenderError when a referenced artifact is missing (Req 9.6)", async () => {
    const config = makeConfig("landscape");
    // Omit the lyrics artifact from the seed.
    const seed = seedFor(config);
    delete seed[`${config.projectId}/${config.artifacts.lyrics}`];
    const store = makeStore(seed);
    const backend = makeBackend();

    await expect(
      renderProject(config, store, { backend, entryPoint: "/fake/index.js" }),
    ).rejects.toThrowError(RenderError);
  });
});
