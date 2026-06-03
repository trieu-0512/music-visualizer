/**
 * Headless render and audio mux for the Render_Engine (task 10.4).
 *
 * `renderProject` is invoked by the render worker (task 10.6) after it claims a
 * `render` job. It turns a project's `project-config.json` (plus the
 * `lyrics.json` / `audio-analysis.json` artifacts it references) into the final
 * MP4 files:
 *
 *   - `landscape` -> Full HD, 2K, and 4K 16:9 MP4s at 60fps
 *   - `portrait`  -> Full HD, 2K, and 4K 9:16 MP4s at 60fps
 *
 * Each video is produced by Remotion's headless Chromium + FFmpeg pipeline
 * (`bundle` -> `selectComposition` -> `renderMedia`). Because the templates
 * already place `<Audio src={config.assets.audio}>` inside the composition, the
 * Audio_Asset is part of the timeline and is muxed into the MP4 by rendering
 * with an `aac` audio codec (Req 9.4). Any failure rejects with a descriptive
 * {@link RenderError} so the worker can record the job as failed (Req 9.6).
 *
 * ## Asset resolution strategy (documented assumption)
 *
 * `project-config.json` references every asset by a **project-relative storage
 * path** (e.g. `"assets/background.jpg"`, `"assets/letters/T.svg"`,
 * `"assets/audio.mp3"`). For a headless render those paths must resolve to real
 * files the bundled composition can load. This module *stages* the project's
 * assets out of the {@link RenderAssetStore} into a temporary `public/`
 * directory that mirrors the same relative layout, and bundles with that
 * directory as Remotion's public dir. The templates resolve bare paths with
 * `staticFile` (see `components/assets.ts`), so a staged
 * `public/assets/background.jpg` is served by Remotion's render server and the
 * config needs no rewriting. Staging reads bytes through the store interface
 * (`store.read`), so it works for any backend — the local FS today, a cloud
 * backend later — without changing callers (Req 13.2, 13.3, 15.2).
 *
 * ## Testability
 *
 * The pure target expansion ({@link expandRenderTargets}) and the asset
 * inventory ({@link collectAssetPaths}) carry no Chromium dependency and are
 * unit tested directly. The heavy `bundle` / `selectComposition` /
 * `renderMedia` calls are isolated behind the injectable {@link RenderBackend}
 * seam so `renderProject`'s orchestration (staging, output naming, storage
 * writes) can be exercised with a fake backend and never launches a browser in
 * tests. The real integration render is covered separately (task 10.5).
 */
import { Buffer } from "node:buffer";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateAudioAnalysis,
  validateLyrics,
  type AudioAnalysisJson,
  type LyricsJson,
  type ProjectConfigJson,
  type VideoFormat,
} from "@music-visualizer/shared";

/* -------------------------------------------------------------------------- */
/* Storage seam                                                               */
/* -------------------------------------------------------------------------- */

/**
 * An abstract address for a stored file: a project scope plus the file's path
 * relative to that project. Mirrors the backend `AssetRef` (Req 13.2).
 */
export interface AssetRef {
  projectId: string;
  relativePath: string;
}

/**
 * The minimal subset of the Asset_Store this module needs.
 *
 * Declared locally (rather than importing the backend's `AssetStore`) so the
 * Render_Engine stays decoupled from the backend package. The real
 * `LocalAssetStore` — and any future backend — satisfies this structurally, so
 * the render worker (task 10.6) passes the concrete store unchanged.
 */
export interface RenderAssetStore {
  /** Read the full contents of the file at `ref`. */
  read(ref: AssetRef): Promise<Buffer>;
  /** Persist `data` at `ref`, creating any missing parent directories. */
  write(ref: AssetRef, data: Buffer): Promise<void>;
  /** Report whether a file exists at `ref` (optional; enables clearer errors). */
  exists?(ref: AssetRef): Promise<boolean>;
}

/* -------------------------------------------------------------------------- */
/* Render targets (pure)                                                      */
/* -------------------------------------------------------------------------- */

/** One concrete output to render for a project. */
export interface RenderTarget {
  /** Orientation of this output. */
  format: "landscape" | "portrait";
  /** Output quality tier. */
  quality: "fullhd" | "2k" | "4k";
  /** Composition id registered in `Root.tsx` to render. */
  compositionId:
    | "landscape-fullhd"
    | "portrait-fullhd"
    | "landscape-2k"
    | "portrait-2k"
    | "landscape-4k"
    | "portrait-4k";
  /** Standardized output file name. */
  fileName:
    | "final-16x9-fullhd-60fps.mp4"
    | "final-9x16-fullhd-60fps.mp4"
    | "final-16x9-2k-60fps.mp4"
    | "final-9x16-2k-60fps.mp4"
    | "final-16x9-4k-60fps.mp4"
    | "final-9x16-4k-60fps.mp4";
  /** Project-relative storage path the produced video is written to. */
  relativePath: string;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
}

/** Landscape (16x9) Full HD output target. */
export const LANDSCAPE_FULLHD_TARGET: RenderTarget = {
  format: "landscape",
  quality: "fullhd",
  compositionId: "landscape-fullhd",
  fileName: "final-16x9-fullhd-60fps.mp4",
  relativePath: "artifacts/final-16x9-fullhd-60fps.mp4",
  width: 1920,
  height: 1080,
};

/** Portrait (9x16) Full HD output target. */
export const PORTRAIT_FULLHD_TARGET: RenderTarget = {
  format: "portrait",
  quality: "fullhd",
  compositionId: "portrait-fullhd",
  fileName: "final-9x16-fullhd-60fps.mp4",
  relativePath: "artifacts/final-9x16-fullhd-60fps.mp4",
  width: 1080,
  height: 1920,
};

/** Landscape outputs in increasing quality order. */
export const LANDSCAPE_TARGETS: readonly RenderTarget[] = [
  LANDSCAPE_FULLHD_TARGET,
  {
    format: "landscape",
    quality: "2k",
    compositionId: "landscape-2k",
    fileName: "final-16x9-2k-60fps.mp4",
    relativePath: "artifacts/final-16x9-2k-60fps.mp4",
    width: 2560,
    height: 1440,
  },
  {
    format: "landscape",
    quality: "4k",
    compositionId: "landscape-4k",
    fileName: "final-16x9-4k-60fps.mp4",
    relativePath: "artifacts/final-16x9-4k-60fps.mp4",
    width: 3840,
    height: 2160,
  },
];

/** Portrait outputs in increasing quality order. */
export const PORTRAIT_TARGETS: readonly RenderTarget[] = [
  PORTRAIT_FULLHD_TARGET,
  {
    format: "portrait",
    quality: "2k",
    compositionId: "portrait-2k",
    fileName: "final-9x16-2k-60fps.mp4",
    relativePath: "artifacts/final-9x16-2k-60fps.mp4",
    width: 1440,
    height: 2560,
  },
  {
    format: "portrait",
    quality: "4k",
    compositionId: "portrait-4k",
    fileName: "final-9x16-4k-60fps.mp4",
    relativePath: "artifacts/final-9x16-4k-60fps.mp4",
    width: 2160,
    height: 3840,
  },
];

/** Backward-compatible alias for the default landscape target used by tests. */
export const LANDSCAPE_TARGET = LANDSCAPE_FULLHD_TARGET;

/** Backward-compatible alias for the default portrait target used by tests. */
export const PORTRAIT_TARGET = PORTRAIT_FULLHD_TARGET;

/**
 * Expand a requested {@link VideoFormat} into the ordered list of concrete
 * render targets.
 *
 * Pure and Chromium-free so it is unit tested directly.
 */
export function expandRenderTargets(videoFormat: VideoFormat): RenderTarget[] {
  switch (videoFormat) {
    case "landscape":
      return [...LANDSCAPE_TARGETS];
    case "portrait":
      return [...PORTRAIT_TARGETS];
    case "both":
      return [...LANDSCAPE_TARGETS, ...PORTRAIT_TARGETS];
    default: {
      // Exhaustiveness guard: a new VideoFormat must extend this mapping.
      const unreachable: never = videoFormat;
      throw new RenderError(
        `Unknown videoFormat: ${JSON.stringify(unreachable)}`,
      );
    }
  }
}

/**
 * The distinct project-relative asset paths a render must stage so the bundled
 * composition can load them: background, both logos, the audio, and the 26
 * letters. Duplicate paths are collapsed.
 */
export function collectAssetPaths(assets: ProjectConfigJson["assets"]): string[] {
  const paths = [
    assets.background,
    assets.songLogo,
    assets.channelLogo,
    assets.audio,
    ...Object.values(assets.letters),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return [...new Set(paths)];
}

/** Select the orientation-specific template for a concrete render target. */
function configForTarget(
  config: ProjectConfigJson,
  target: RenderTarget,
): ProjectConfigJson {
  return {
    ...config,
    layout: {
      ...config.layout,
      template:
        target.format === "portrait"
          ? "classic-portrait"
          : "classic-landscape",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Render backend seam                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Opaque handle to a selected Remotion composition (a remotion `VideoConfig`).
 * Kept opaque in the seam so callers/tests never depend on Remotion types.
 */
export type SelectedComposition = unknown;

/** Options for {@link RenderBackend.bundle}. */
export interface BundleOptions {
  /** Path to the Remotion entry that calls `registerRoot`. */
  entryPoint: string;
  /** Directory served as Remotion's `public/` (staged assets), or `null`. */
  publicDir: string | null;
}

/** Options for {@link RenderBackend.selectComposition}. */
export interface SelectCompositionOptions {
  serveUrl: string;
  id: string;
  inputProps: Record<string, unknown>;
}

/** Options for {@link RenderBackend.renderMedia}. */
export interface RenderMediaOptions {
  serveUrl: string;
  composition: SelectedComposition;
  outputLocation: string;
  inputProps: Record<string, unknown>;
}

/**
 * The seam over Remotion's heavy bundle/select/render pipeline.
 *
 * The default implementation ({@link createRemotionRenderBackend}) lazily loads
 * `@remotion/bundler` and `@remotion/renderer` and drives headless Chromium +
 * FFmpeg. Tests inject a fake to exercise orchestration without a browser.
 */
export interface RenderBackend {
  /** Bundle the Remotion project and return a serve URL. */
  bundle(options: BundleOptions): Promise<string>;
  /** Select a composition by id, returning an opaque composition handle. */
  selectComposition(
    options: SelectCompositionOptions,
  ): Promise<SelectedComposition>;
  /** Render the composition to an MP4 (h264 video + aac audio) on disk. */
  renderMedia(options: RenderMediaOptions): Promise<void>;
}

/** Module type of `@remotion/renderer`, used only for internal casts. */
type RendererModule = typeof import("@remotion/renderer");
/** Remotion's `VideoConfig`, recovered without importing the type by name. */
type RemotionComposition = Awaited<
  ReturnType<RendererModule["selectComposition"]>
>;

/**
 * Default {@link RenderBackend} backed by Remotion. The bundler/renderer are
 * imported dynamically so importing this module (e.g. for the pure helpers or
 * for tests with a fake backend) never pulls in the native render binaries.
 */
export function createRemotionRenderBackend(): RenderBackend {
  return {
    async bundle(options) {
      const { bundle } = await import("@remotion/bundler");
      return bundle({
        entryPoint: options.entryPoint,
        publicDir: options.publicDir,
      });
    },
    async selectComposition(options) {
      const { selectComposition } = await import("@remotion/renderer");
      return selectComposition({
        serveUrl: options.serveUrl,
        id: options.id,
        inputProps: options.inputProps,
      });
    },
    async renderMedia(options) {
      const { renderMedia } = await import("@remotion/renderer");
      await renderMedia({
        serveUrl: options.serveUrl,
        composition: options.composition as RemotionComposition,
        codec: "h264",
        audioCodec: "aac", // mux the Audio_Asset on the timeline (Req 9.4)
        outputLocation: options.outputLocation,
        inputProps: options.inputProps,
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* renderProject                                                              */
/* -------------------------------------------------------------------------- */

/** Error thrown when a render cannot be completed (Req 9.6). */
export class RenderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RenderError";
  }
}

/** Optional dependencies / overrides for {@link renderProject}. */
export interface RenderProjectDeps {
  /** Render backend to use. Defaults to the Remotion-backed implementation. */
  backend?: RenderBackend;
  /**
   * Path to the Remotion entry that calls `registerRoot`. Defaults to the
   * sibling `index.js` of this module (the registered `landscape`/`portrait`
   * compositions).
   */
  entryPoint?: string;
  /**
   * Base directory for the throwaway staging + output workspace. Defaults to
   * the OS temp dir. The created subdirectory is always removed afterwards.
   */
  workDir?: string;
}

/** Already-resolved asset locations are loaded directly, not staged. */
const ALREADY_RESOLVED =
  /^(https?:)?\/\/|^(data|blob|file):|^\/|^[a-zA-Z]:[\\/]/;

/** Default Remotion entry: the `index.js` sibling of this compiled module. */
function defaultEntryPoint(): string {
  return fileURLToPath(new URL("./index.js", import.meta.url));
}

/** Parse + validate a JSON artifact read from the store, or throw {@link RenderError}. */
async function loadArtifact<T>(
  store: RenderAssetStore,
  projectId: string,
  relativePath: string,
  validate: (data: unknown) => { ok: true; value: T } | { ok: false; error: unknown },
  label: string,
): Promise<T> {
  let raw: Buffer;
  try {
    raw = await store.read({ projectId, relativePath });
  } catch (cause) {
    throw new RenderError(
      `Failed to read ${label} at '${relativePath}' for project '${projectId}'`,
      { cause },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (cause) {
    throw new RenderError(`${label} at '${relativePath}' is not valid JSON`, {
      cause,
    });
  }
  const result = validate(parsed);
  if (!result.ok) {
    throw new RenderError(
      `${label} at '${relativePath}' is not a valid ${label}: ${JSON.stringify(result.error)}`,
    );
  }
  return result.value;
}

/**
 * Stage one project asset out of the store into `publicDir`, preserving its
 * relative layout. Already-resolved locations (absolute paths / URLs) are
 * skipped — they are loaded directly by the template's asset resolver.
 */
async function stageAsset(
  store: RenderAssetStore,
  projectId: string,
  relativePath: string,
  publicDir: string,
): Promise<void> {
  if (ALREADY_RESOLVED.test(relativePath)) return;
  let bytes: Buffer;
  try {
    bytes = await store.read({ projectId, relativePath });
  } catch (cause) {
    throw new RenderError(
      `Failed to stage asset '${relativePath}' for project '${projectId}'`,
      { cause },
    );
  }
  const target = join(publicDir, ...relativePath.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

/**
 * Render every output requested by `config.videoFormat` and store each produced
 * MP4 under the owning project at its standardized `artifacts/...` path.
 *
 * @param config The project's validated `project-config.json`.
 * @param store  The Asset_Store the project's assets/artifacts live in.
 * @param deps   Optional backend/entry/workspace overrides (for tests).
 * @returns The project-relative paths of the produced videos
 *          (e.g. `["artifacts/final-16x9-fullhd-60fps.mp4", ...]`).
 * @throws {@link RenderError} on any failure, with a message describing the
 *         stage that failed so the render worker can record it (Req 9.6).
 */
export async function renderProject(
  config: ProjectConfigJson,
  store: RenderAssetStore,
  deps: RenderProjectDeps = {},
): Promise<string[]> {
  const backend = deps.backend ?? createRemotionRenderBackend();
  const entryPoint = deps.entryPoint ?? defaultEntryPoint();
  const baseDir = deps.workDir ?? tmpdir();

  const targets = expandRenderTargets(config.videoFormat);

  // Load the artifacts the composition is driven by (Req 8.x parity with preview).
  const lyrics: LyricsJson = await loadArtifact(
    store,
    config.projectId,
    config.artifacts.lyrics,
    validateLyrics,
    "lyrics.json",
  );
  const analysis: AudioAnalysisJson = await loadArtifact(
    store,
    config.projectId,
    config.artifacts.audioAnalysis,
    validateAudioAnalysis,
    "audio-analysis.json",
  );

  const work = await mkdtemp(join(baseDir, "mv-render-"));
  const publicDir = join(work, "public");
  const outDir = join(work, "out");
  try {
    await mkdir(publicDir, { recursive: true });
    await mkdir(outDir, { recursive: true });

    // Stage assets so the bundled composition can load them via `staticFile`.
    for (const assetPath of collectAssetPaths(config.assets)) {
      await stageAsset(store, config.projectId, assetPath, publicDir);
    }

    let serveUrl: string;
    try {
      serveUrl = await backend.bundle({ entryPoint, publicDir });
    } catch (cause) {
      throw new RenderError(
        `Failed to bundle the Remotion project for '${config.projectId}'`,
        { cause },
      );
    }

    const produced: string[] = [];

    for (const target of targets) {
      const outputLocation = join(outDir, target.fileName);
      const targetConfig = configForTarget(config, target);
      const inputProps: Record<string, unknown> = {
        config: targetConfig,
        lyrics,
        analysis,
      };
      try {
        const composition = await backend.selectComposition({
          serveUrl,
          id: target.compositionId,
          inputProps,
        });
        await backend.renderMedia({
          serveUrl,
          composition,
          outputLocation,
          inputProps,
        });
      } catch (cause) {
        throw new RenderError(
          `Failed to render ${target.fileName} (${target.width}x${target.height}) for '${config.projectId}'`,
          { cause },
        );
      }

      let bytes: Buffer;
      try {
        bytes = await readFile(outputLocation);
      } catch (cause) {
        throw new RenderError(
          `Render of ${target.fileName} produced no output file`,
          { cause },
        );
      }
      await store.write(
        { projectId: config.projectId, relativePath: target.relativePath },
        bytes,
      );
      produced.push(target.relativePath);
    }

    return produced;
  } finally {
    // Always remove the throwaway staging + output workspace.
    await rm(work, { recursive: true, force: true });
  }
}
