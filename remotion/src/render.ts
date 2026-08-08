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
import { createRequire } from "node:module";
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
  /**
   * Remove the file at `ref`. Implementations should no-op or resolve when the
   * file is absent (Architecture Upgrade KD-23).
   */
  delete(ref: AssetRef): Promise<void>;
  /** Report whether a file exists at `ref` (optional; enables clearer errors). */
  exists?(ref: AssetRef): Promise<boolean>;
}

/** Standardized final MP4 artifact paths produced by {@link expandRenderTargets}. */
export const STANDARD_FINAL_MP4_PATHS: readonly string[] = [
  "artifacts/final-16x9-fullhd-60fps.mp4",
  "artifacts/final-9x16-fullhd-60fps.mp4",
  "artifacts/final-16x9-2k-60fps.mp4",
  "artifacts/final-9x16-2k-60fps.mp4",
  "artifacts/final-16x9-4k-60fps.mp4",
  "artifacts/final-9x16-4k-60fps.mp4",
];

/**
 * Best-effort delete of all standardized final MP4s for a project so a new
 * render (or format override) does not leave mixed outputs (KD-6).
 */
export async function clearStandardFinalMp4s(
  store: RenderAssetStore,
  projectId: string,
): Promise<void> {
  for (const relativePath of STANDARD_FINAL_MP4_PATHS) {
    try {
      await store.delete({ projectId, relativePath });
    } catch {
      // Missing files or store quirks must not block the render.
    }
  }
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

export type RenderTargetSelector =
  | RenderTarget["compositionId"]
  | RenderTarget["quality"]
  | `${RenderTarget["format"]}-${RenderTarget["quality"]}`
  | RenderTarget["fileName"];

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
 * composition can load them: background, both logos, the audio, the 26 letters, and optional theme-first
 * object assets. Duplicate paths are collapsed.
 */
export function collectAssetPaths(assets: ProjectConfigJson["assets"]): string[] {
  const paths = [
    assets.background,
    assets.songLogo,
    assets.channelLogo,
    assets.audio,
    ...Object.values(assets.letters),
    ...Object.values(assets.objects ?? {}),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return [...new Set(paths)];
}

function targetMatchesSelector(
  target: RenderTarget,
  selector: RenderTargetSelector,
): boolean {
  return (
    selector === target.compositionId ||
    selector === target.quality ||
    selector === `${target.format}-${target.quality}` ||
    selector === target.fileName
  );
}

export function filterRenderTargets(
  targets: readonly RenderTarget[],
  selectors: readonly RenderTargetSelector[],
): RenderTarget[] {
  if (selectors.length === 0) return [...targets];
  return targets.filter((target) =>
    selectors.some((selector) => targetMatchesSelector(target, selector)),
  );
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

export type X264Preset =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower"
  | "veryslow"
  | "placebo";

export type Bitrate = `${number}k` | `${number}K` | `${number}M`;
export type FrameRange = number | [number, number] | [number, null];
export type EncoderMode = "x264" | "amf";
export type HardwareAccelerationMode = "disable" | "if-possible" | "required";
export type ChromeMode = "headless-shell" | "chrome-for-testing";
export type OpenGlRenderer =
  | "swangle"
  | "angle"
  | "egl"
  | "swiftshader"
  | "vulkan"
  | "angle-egl";

export interface RemotionRenderSettings {
  encoder?: EncoderMode;
  binariesDirectory?: string | null;
  crf?: number | null;
  videoBitrate?: Bitrate | null;
  encodingMaxRate?: Bitrate | null;
  encodingBufferSize?: Bitrate | null;
  x264Preset?: X264Preset | null;
  concurrency?: number | string | null;
  audioBitrate?: Bitrate | null;
  frameRange?: FrameRange | null;
  offthreadVideoThreads?: number | null;
  hardwareAcceleration?: HardwareAccelerationMode | null;
  chromeMode?: ChromeMode | null;
  gl?: OpenGlRenderer | null;
}

export const DEFAULT_REMOTION_RENDER_SETTINGS: Required<RemotionRenderSettings> = {
  encoder: "x264",
  binariesDirectory: null,
  crf: 12,
  videoBitrate: null,
  encodingMaxRate: null,
  encodingBufferSize: null,
  x264Preset: "medium",
  concurrency: 6,
  audioBitrate: "192k",
  frameRange: null,
  offthreadVideoThreads: 8,
  hardwareAcceleration: "if-possible",
  chromeMode: "headless-shell",
  gl: "angle",
};

export interface RenderProgress {
  renderedFrames: number;
  encodedFrames: number;
  encodedDoneIn: number | null;
  renderedDoneIn: number | null;
  renderEstimatedTime: number;
  progress: number;
  stitchStage: "encoding" | "muxing";
}

/** Options for {@link RenderBackend.renderMedia}. */
export interface RenderMediaOptions extends RemotionRenderSettings {
  serveUrl: string;
  composition: SelectedComposition;
  outputLocation: string;
  inputProps: Record<string, unknown>;
  onProgress?: (progress: RenderProgress) => void;
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

const require = createRequire(import.meta.url);
let nativeAacOverrideInstalled = false;

function removeOption(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      i += 1;
      continue;
    }
    out.push(args[i]!);
  }
  return out;
}

function createAmfFfmpegOverride(): (info: {
  type: "pre-stitcher" | "stitcher";
  args: string[];
}) => string[] {
  return ({ type, args }) => {
    const argsWithNativeAac = args.map((arg) =>
      arg === "libfdk_aac" ? "aac" : arg,
    );
    if (type !== "stitcher") return argsWithNativeAac;

    const cleaned = removeOption(
      removeOption(removeOption(argsWithNativeAac, "-crf"), "-preset"),
      "-x264-params",
    );
    const out: string[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      const arg = cleaned[i]!;
      const next = cleaned[i + 1];
      if (
        (arg === "-c:v" || arg === "-codec:v" || arg === "-vcodec") &&
        next === "libx264"
      ) {
        out.push(
          arg,
          "h264_amf",
          "-usage",
          "high_quality",
          "-quality",
          "quality",
          "-rc",
          "hqcbr",
          "-profile:v",
          "high",
          "-async_depth",
          "16",
          "-preanalysis",
          "true",
        );
        i += 1;
        continue;
      }
      out.push(arg);
    }
    return out;
  };
}

function installNativeAacAudioCodecOverride(): void {
  if (nativeAacOverrideInstalled) return;
  const rendererEntry = require.resolve("@remotion/renderer");
  const audioCodecPath = join(dirname(rendererEntry), "options", "audio-codec.js");
  const audioCodecModule = require(audioCodecPath) as {
    mapAudioCodecToFfmpegAudioCodecName: (audioCodec: string) => string;
  };
  const original = audioCodecModule.mapAudioCodecToFfmpegAudioCodecName;
  audioCodecModule.mapAudioCodecToFfmpegAudioCodecName = (audioCodec: string) =>
    audioCodec === "aac" ? "aac" : original(audioCodec);
  nativeAacOverrideInstalled = true;
}

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
      const { selectComposition } = require("@remotion/renderer") as RendererModule;
      return selectComposition({
        serveUrl: options.serveUrl,
        id: options.id,
        inputProps: options.inputProps,
      });
    },
    async renderMedia(options) {
      const requestedEncoder =
        options.encoder ?? DEFAULT_REMOTION_RENDER_SETTINGS.encoder;
      if (requestedEncoder === "amf") {
        installNativeAacAudioCodecOverride();
      }
      const { renderMedia } = require("@remotion/renderer") as RendererModule;
      const crf =
        options.videoBitrate === undefined || options.videoBitrate === null
          ? (options.crf ?? DEFAULT_REMOTION_RENDER_SETTINGS.crf)
          : null;
      const renderSettings = {
        ...DEFAULT_REMOTION_RENDER_SETTINGS,
        encoder: requestedEncoder,
        binariesDirectory: options.binariesDirectory ?? null,
        crf,
        videoBitrate: options.videoBitrate ?? null,
        encodingMaxRate: options.encodingMaxRate ?? null,
        encodingBufferSize: options.encodingBufferSize ?? null,
        x264Preset:
          options.x264Preset ?? DEFAULT_REMOTION_RENDER_SETTINGS.x264Preset,
        concurrency:
          options.concurrency ?? DEFAULT_REMOTION_RENDER_SETTINGS.concurrency,
        audioBitrate:
          options.audioBitrate ?? DEFAULT_REMOTION_RENDER_SETTINGS.audioBitrate,
        frameRange: options.frameRange ?? null,
        offthreadVideoThreads:
          options.offthreadVideoThreads ??
          DEFAULT_REMOTION_RENDER_SETTINGS.offthreadVideoThreads,
        hardwareAcceleration:
          options.hardwareAcceleration ??
          (crf === null ? "if-possible" : "disable"),
        chromeMode: options.chromeMode ?? "headless-shell",
        gl: options.gl ?? "angle",
      };
      const {
        encoder,
        gl,
        ...remotionSettings
      } = renderSettings;
      await renderMedia({
        serveUrl: options.serveUrl,
        composition: options.composition as RemotionComposition,
        codec: "h264",
        audioCodec: "aac", // mux the Audio_Asset on the timeline (Req 9.4)
        pixelFormat: "yuv420p",
        colorSpace: "bt709",
        chromiumOptions: gl === null ? undefined : { gl },
        ffmpegOverride: encoder === "amf" ? createAmfFfmpegOverride() : undefined,
        overwrite: true,
        onProgress: options.onProgress,
        ...remotionSettings,
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
  targetSelectors?: RenderTargetSelector[];
  renderSettings?: RemotionRenderSettings;
  outputTag?: string;
  /**
   * Job-scoped video format override (Architecture Upgrade KD-6 / PR-06).
   * When set, expands targets from this value instead of `config.videoFormat`
   * without rewriting `project-config.json`.
   */
  videoFormatOverride?: VideoFormat;
}

/** Already-resolved asset locations are loaded directly, not staged. */
const ALREADY_RESOLVED =
  /^(https?:)?\/\/|^(data|blob|file):|^\/|^[a-zA-Z]:[\\/]/;

function taggedPath(path: string, tag?: string): string {
  if (!tag) return path;
  const safeTag = tag.replace(/[^a-zA-Z0-9._-]/g, "-");
  return path.replace(/\.mp4$/i, `-${safeTag}.mp4`);
}

function doubleBitrate(rate: Bitrate): Bitrate {
  const match = /^(\d+(?:\.\d+)?)([kKM])$/.exec(rate);
  if (!match) return rate;
  const value = Number(match[1]) * 2;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${match[2]}` as Bitrate;
}

function defaultAmfBitrate(target: RenderTarget): Bitrate {
  if (target.quality === "4k") return "100M";
  if (target.quality === "2k") return "60M";
  return "35M";
}

function settingsForTarget(
  settings: RemotionRenderSettings | undefined,
  target: RenderTarget,
): RemotionRenderSettings {
  const encoder =
    settings?.encoder ??
    (settings?.crf !== undefined && settings.crf !== null
      ? "x264"
      : DEFAULT_REMOTION_RENDER_SETTINGS.encoder);
  if (encoder !== "amf") {
    return { ...settings, encoder };
  }

  if (settings?.crf !== undefined && settings.crf !== null) {
    throw new RenderError(
      "CRF is not supported with AMD AMF. Use x264 for CRF or use AMF bitrate settings.",
    );
  }

  const videoBitrate = settings?.videoBitrate ?? defaultAmfBitrate(target);
  return {
    ...settings,
    encoder,
    crf: null,
    videoBitrate,
    encodingMaxRate: settings?.encodingMaxRate ?? videoBitrate,
    encodingBufferSize: settings?.encodingBufferSize ?? doubleBitrate(videoBitrate),
    x264Preset: null,
    hardwareAcceleration: settings?.hardwareAcceleration ?? "disable",
  };
}

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

  // Precedence: videoFormatOverride → config.videoFormat → expand → targetSelectors.
  const effectiveFormat: VideoFormat =
    deps.videoFormatOverride ?? config.videoFormat;
  const targets = filterRenderTargets(
    expandRenderTargets(effectiveFormat),
    deps.targetSelectors ?? [],
  );
  if (targets.length === 0) {
    throw new RenderError(
      `No render targets matched selectors: ${(deps.targetSelectors ?? []).join(", ")}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[render] project=${config.projectId} effectiveFormat=${effectiveFormat} targets=${targets
      .map((t) => t.compositionId)
      .join(",")}`,
  );

  // Clear prior finals so format overrides / retries do not leave mixed MP4s (KD-6).
  await clearStandardFinalMp4s(store, config.projectId);

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
      const fileName = taggedPath(target.fileName, deps.outputTag);
      const relativePath = taggedPath(target.relativePath, deps.outputTag);
      const outputLocation = join(outDir, fileName);
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
          ...settingsForTarget(deps.renderSettings, target),
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
          `Render of ${fileName} produced no output file`,
          { cause },
        );
      }
      await store.write(
        { projectId: config.projectId, relativePath },
        bytes,
      );
      produced.push(relativePath);
    }

    return produced;
  } finally {
    // Always remove the throwaway staging + output workspace.
    await rm(work, { recursive: true, force: true });
  }
}
