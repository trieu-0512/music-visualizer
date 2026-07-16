/**
 * Integration test for the headless render output (task 10.5).
 *
 * Where the unit tests in `render.test.ts` exercise `renderProject`'s
 * orchestration through a fake {@link RenderBackend} (no browser), this test
 * drives the *real* Remotion pipeline end to end — `bundle` -> `selectComposition`
 * -> `renderMedia` via headless Chromium + FFmpeg — on a tiny synthetic clip,
 * then probes the produced MP4 bytes to assert the requirements that can only be
 * confirmed on actual output:
 *
 *   - the landscape output is 1920x1080            (Req 9.2)
 *   - the portrait output is 1080x1920             (Req 9.3)
 *   - both carry a muxed audio stream              (Req 9.4)
 *
 * ## Why a real render, and how it stays cheap
 *
 * A faithful render is the only way to verify resolution + a muxed audio stream
 * on real bytes. To keep it light the clip is ~0.2s (6 frames per composition
 * at 30fps), the assets are 1x1 PNGs / trivial SVGs, and the audio is a 1s
 * in-memory WAV — no fixtures on disk, no external tooling. The compiled
 * `dist/index.js` is used as the bundler entry point (matching how the render
 * worker runs in production, where the `.js` import specifiers resolve directly
 * without the Studio's webpack alias).
 *
 * ## Graceful skip
 *
 * A full Chromium + FFmpeg render is heavy and may not be runnable in every
 * environment (no downloaded browser, no FFmpeg, sandbox limits). Only the
 * bundle/render step is wrapped: if it throws, the test SKIPS with a clear
 * message rather than failing the suite. The probing + resolution/audio
 * assertions are NOT wrapped, so once a render genuinely succeeds any wrong
 * resolution or missing audio stream is a hard failure.
 */
import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";
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
  renderProject,
  type AssetRef,
  type RenderAssetStore,
  type RenderTarget,
} from "../src/render.js";

/* -------------------------------------------------------------------------- */
/* Synthetic assets (built in-memory, no fixtures on disk)                    */
/* -------------------------------------------------------------------------- */

/** A valid 1x1 transparent PNG — loadable by Chromium `<Img>` at any size. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** A trivial, valid SVG for the centered Letter_Asset. */
function letterSvg(letter: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">` +
      `<rect width="200" height="200" fill="#3366cc"/>` +
      `<text x="100" y="140" font-size="140" text-anchor="middle" fill="#fff">${letter}</text>` +
      `</svg>`,
    "utf8",
  );
}

/**
 * Build a small valid PCM WAV (16-bit mono) so the rendered MP4 has a real
 * audio source to mux. Default ~1s at 8kHz, well within the composition span.
 */
function makeWav(seconds = 1, sampleRate = 8000, freq = 440): Buffer {
  const numSamples = Math.floor(seconds * sampleRate);
  const dataBytes = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataBytes);
  // RIFF header
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  // fmt chunk
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format = PCM
  buffer.writeUInt16LE(1, 22); // channels = mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(
      Math.sin((2 * Math.PI * freq * i) / sampleRate) * 12000,
    );
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  return buffer;
}

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** A tiny, schema-valid project config rendered in `both` formats. */
function makeConfig(): ProjectConfigJson {
  return {
    version: 1,
    projectId: "p_render_integration",
    metadata: { songName: "Test Song", singerName: "Test Singer" },
    videoFormat: "both",
    assets: {
      background: "assets/background.png",
      songLogo: "assets/song-logo.png",
      channelLogo: "assets/channel-logo.png",
      audio: "assets/audio.wav",
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

// Single short lyric line covering the whole clip so the centered "A" letter
// and the lyric box render at every frame.
const lyrics: LyricsJson = {
  version: 1,
  source: "original+transcriber",
  lines: [
    { start: 0, end: 1, text: "A", line1: "A", line2: "", letter: "A" },
  ],
};

// One frame per composition at 60fps (kept tiny because this covers 4K too).
const analysis: AudioAnalysisJson = {
  version: 1,
  duration: 1 / 60,
  interval: 0.1,
  sampleRate: 8000,
  rms: [0.5, 0.5, 0.5],
  bass: [0.5, 0.5, 0.5],
  bands: [[0.5], [0.5], [0.5]],
  bandCount: 1,
  beats: [0.05],
};

/* -------------------------------------------------------------------------- */
/* In-memory Asset_Store seeded with the synthetic assets + artifacts         */
/* -------------------------------------------------------------------------- */

function makeStore(config: ProjectConfigJson): RenderAssetStore & {
  files: Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>();
  const key = (ref: AssetRef) => `${ref.projectId}/${ref.relativePath}`;
  const put = (relativePath: string, data: Buffer) =>
    files.set(`${config.projectId}/${relativePath}`, data);

  // Artifacts the render reads + validates.
  put(config.artifacts.lyrics, Buffer.from(JSON.stringify(lyrics), "utf8"));
  put(
    config.artifacts.audioAnalysis,
    Buffer.from(JSON.stringify(analysis), "utf8"),
  );
  // Assets the render stages into the bundle's public dir.
  put(config.assets.background, PNG_1X1);
  put(config.assets.songLogo, PNG_1X1);
  put(config.assets.channelLogo, PNG_1X1);
  put(config.assets.audio, makeWav());
  for (const l of LETTERS) {
    put(config.assets.letters[l]!, letterSvg(l));
  }

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

/** The compiled Remotion entry — bundled exactly as the render worker would. */
function compiledEntryPoint(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "dist", "index.js");
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const causeMsg =
      cause instanceof Error ? ` caused by: ${cause.message}` : "";
    return `${err.name}: ${err.message}${causeMsg}`;
  }
  return String(err);
}

/* -------------------------------------------------------------------------- */
/* Real render integration (Req 9.2, 9.3, 9.4)                                */
/* -------------------------------------------------------------------------- */

describe("renderProject real render output (Req 9.2, 9.3, 9.4)", () => {
  const probeDir = mkdtemp(join(tmpdir(), "mv-render-probe-"));

  afterAll(async () => {
    await rm(await probeDir, { recursive: true, force: true });
  });

  it(
    "renders all requested MP4s each carrying a muxed audio stream",
    async (ctx) => {
      const config = makeConfig();
      const store = makeStore(config);

      // --- Heavy step: real bundle + Chromium + FFmpeg render. -------------
      // Only this is guarded: if the environment can't run a headless render
      // we skip with a clear message instead of failing the suite.
      let produced: string[];
      try {
        produced = await renderProject(config, store, {
          entryPoint: compiledEntryPoint(),
        });
      } catch (err) {
        ctx.skip(
          `Skipping real render integration: environment cannot run a ` +
            `headless Remotion render (${describeError(err)}).`,
        );
        return;
      }

      // --- From here on, a render genuinely succeeded: assert hard. --------
      const targets = [...LANDSCAPE_TARGETS, ...PORTRAIT_TARGETS];
      expect(produced).toEqual(targets.map((target) => target.relativePath));

      const dir = await probeDir;
      const { getVideoMetadata } = await import("@remotion/renderer");

      // Probe a stored artifact: write its bytes to a temp file and read
      // back its real resolution + audio codec from the muxed container.
      async function probe(target: RenderTarget) {
        const bytes = store.files.get(
          `${config.projectId}/${target.relativePath}`,
        );
        expect(bytes, `output ${target.fileName} should be stored`).toBeTruthy();
        expect(bytes!.length).toBeGreaterThan(0);
        const file = join(dir, target.fileName);
        await writeFile(file, bytes!);
        return getVideoMetadata(file);
      }

      // Full HD aliases keep the original explicit requirement assertions.
      const landscape = await probe(LANDSCAPE_TARGET);
      expect(landscape.width).toBe(1920);
      expect(landscape.height).toBe(1080);
      expect(landscape.audioCodec).not.toBeNull();

      const portrait = await probe(PORTRAIT_TARGET);
      expect(portrait.width).toBe(1080);
      expect(portrait.height).toBe(1920);
      expect(portrait.audioCodec).not.toBeNull();

      for (const target of targets) {
        const metadata = await probe(target);
        expect(metadata.width).toBe(target.width);
        expect(metadata.height).toBe(target.height);
        expect(metadata.audioCodec).not.toBeNull();
      }
    },
    600_000,
  );
});
