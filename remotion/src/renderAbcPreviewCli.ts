import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { FPS } from "./defaultProps.js";
import {
  DEFAULT_REMOTION_RENDER_SETTINGS,
  createRemotionRenderBackend,
  type RenderProgress,
  type RemotionRenderSettings,
  type HardwareAccelerationMode,
  type OpenGlRenderer,
  type EncoderMode,
  type Bitrate,
} from "./render.js";
import type { AbcPreviewData, AbcPreviewProps } from "./AbcPreviewVideo.js";

const COMPOSITION_ID = "abc-preview-landscape";
const PROGRESS_PREFIX = "ABC_RENDER_PROGRESS ";
const DEFAULT_ABC_PREVIEW_CONCURRENCY = 4;
const DEFAULT_ABC_PREVIEW_SCALE = 2;
const DEFAULT_ABC_PREVIEW_VIDEO_BITRATE: Bitrate = "60M";
const DEFAULT_ABC_PREVIEW_X264_PRESET: RemotionRenderSettings["x264Preset"] = "slow";
const REMOTE_ASSET = /^(https?:)?\/\/|^(data|blob):/;
const FILE_URL = /^file:/;
const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

interface CliArgs {
  previewDir: string;
  output: string;
  renderSettings: RemotionRenderSettings;
  maxDurationSeconds?: number;
}

function usage(): string {
  return [
    "Usage: npm run render:abc-preview -- <song-dir|video_preview-dir|preview-data.json> [options]",
    "",
    "Options:",
    "  --output <mp4>             Output MP4 path (default: video_preview/abc-preview-landscape.mp4)",
    "  --max-duration <seconds>   Render only the first N seconds as a sample file",
    "  --crf <1..51>              x264 CRF mode; disables fixed bitrate",
    `  --x264-preset <preset>     ultrafast..placebo (default: ${DEFAULT_ABC_PREVIEW_X264_PRESET})`,
    `  --concurrency <n|percent>  Remotion render concurrency (default: ${DEFAULT_ABC_PREVIEW_CONCURRENCY})`,
    "  --gl <renderer>            Chromium GL backend: angle, swangle, swiftshader, vulkan, egl, angle-egl",
    "  --hardware-acceleration <mode>  disable, if-possible, required",
    "  --offthread-video-threads <n>   OffthreadVideo decode threads",
    "  --encoder <x264|amf>       H.264 encoder",
    "  --scale <1|2>              Output scale; 2 exports 3840x2160 4K",
    `  --video-bitrate <rate>     Fixed H.264 bitrate (default: ${DEFAULT_ABC_PREVIEW_VIDEO_BITRATE})`,
    "  --maxrate <rate>           FFmpeg maxrate; defaults to --video-bitrate",
    "  --bufsize <rate>           FFmpeg buffer size; defaults to 2x --video-bitrate",
  ].join("\n");
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function resolveCliPath(path: string): string {
  if (isAbsolute(path) || WINDOWS_ABSOLUTE.test(path)) return path;
  const candidates = candidatePaths(path);
  const withExistingParent = candidates.find((candidate) =>
    existsSync(dirname(candidate)),
  );
  return withExistingParent ?? candidates[0]!;
}

function parsePositiveSeconds(value: string, flag: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid ${flag} '${value}'. Expected a positive number.`);
  }
  return seconds;
}

function parseCrf(value: string): number {
  const crf = Number(value);
  if (!Number.isInteger(crf) || crf < 1 || crf > 51) {
    throw new Error(`Invalid --crf '${value}'. Expected integer 1..51.`);
  }
  return crf;
}

function parsePreset(value: string): RemotionRenderSettings["x264Preset"] {
  const presets = [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
    "placebo",
  ];
  if (!presets.includes(value)) {
    throw new Error(`Invalid --x264-preset '${value}'. Expected ${presets.join(", ")}.`);
  }
  return value as RemotionRenderSettings["x264Preset"];
}

function parseGl(value: string): OpenGlRenderer {
  const renderers = ["swangle", "angle", "egl", "swiftshader", "vulkan", "angle-egl"];
  if (!renderers.includes(value)) {
    throw new Error(`Invalid --gl '${value}'. Expected ${renderers.join(", ")}.`);
  }
  return value as OpenGlRenderer;
}

function parseHardwareAcceleration(value: string): HardwareAccelerationMode {
  const modes = ["disable", "if-possible", "required"];
  if (!modes.includes(value)) {
    throw new Error(`Invalid --hardware-acceleration '${value}'. Expected ${modes.join(", ")}.`);
  }
  return value as HardwareAccelerationMode;
}

function parseEncoder(value: string): EncoderMode {
  if (value !== "x264" && value !== "amf") {
    throw new Error(`Invalid --encoder '${value}'. Expected x264 or amf.`);
  }
  return value;
}

function parseBitrate(value: string, flag: string): Bitrate {
  if (!/^\d+(?:\.\d+)?[kKmM]$/.test(value)) {
    throw new Error(`Invalid ${flag} '${value}'. Expected a bitrate like 8000k or 35M.`);
  }
  return value as Bitrate;
}

function doubleBitrate(value: Bitrate): Bitrate {
  const match = /^(\d+(?:\.\d+)?)([kKmM])$/.exec(value);
  if (!match) return value;
  const doubled = Number(match[1]) * 2;
  return `${Number.isInteger(doubled) ? doubled : doubled.toFixed(1)}${match[2]}` as Bitrate;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} '${value}'. Expected a positive integer.`);
  }
  return parsed;
}

function parseScale(value: string): number {
  const scale = Number(value);
  if (!Number.isInteger(scale) || (scale !== 1 && scale !== 2)) {
    throw new Error(`Invalid --scale '${value}'. Expected 1 or 2.`);
  }
  return scale;
}

function parseConcurrency(value: string): number | string {
  if (value.endsWith("%")) {
    const percent = Number(value.slice(0, -1));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error(`Invalid --concurrency '${value}'. Expected 1%..100%.`);
    }
    return `${percent}%`;
  }
  return parsePositiveInteger(value, "--concurrency");
}

function parseArgs(argv: string[]): CliArgs {
  const [inputArg, ...rest] = argv;
  if (!inputArg) {
    throw new Error(usage());
  }

  const previewDir = resolvePreviewDir(inputArg);
  const renderSettings: RemotionRenderSettings = {
    encoder: "x264",
    crf: null,
    videoBitrate: DEFAULT_ABC_PREVIEW_VIDEO_BITRATE,
    encodingMaxRate: DEFAULT_ABC_PREVIEW_VIDEO_BITRATE,
    encodingBufferSize: doubleBitrate(DEFAULT_ABC_PREVIEW_VIDEO_BITRATE),
    x264Preset: DEFAULT_ABC_PREVIEW_X264_PRESET,
    concurrency: DEFAULT_ABC_PREVIEW_CONCURRENCY,
    hardwareAcceleration: "disable",
    chromeMode: "headless-shell",
    gl: "angle",
    scale: DEFAULT_ABC_PREVIEW_SCALE,
    offthreadVideoThreads: 2,
  };
  let output: string | undefined;
  let maxDurationSeconds: number | undefined;
  let explicitMaxRate = false;
  let explicitBufferSize = false;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    if (arg === "--output") {
      output = resolveCliPath(requireValue(rest, ++i, arg));
    } else if (arg === "--max-duration") {
      maxDurationSeconds = parsePositiveSeconds(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--crf") {
      renderSettings.crf = parseCrf(requireValue(rest, ++i, arg));
      renderSettings.videoBitrate = null;
      renderSettings.encodingMaxRate = null;
      renderSettings.encodingBufferSize = null;
    } else if (arg === "--x264-preset") {
      renderSettings.x264Preset = parsePreset(requireValue(rest, ++i, arg));
    } else if (arg === "--concurrency") {
      const value = requireValue(rest, ++i, arg);
      renderSettings.concurrency = parseConcurrency(value);
    } else if (arg === "--gl") {
      renderSettings.gl = parseGl(requireValue(rest, ++i, arg));
    } else if (arg === "--hardware-acceleration") {
      renderSettings.hardwareAcceleration = parseHardwareAcceleration(requireValue(rest, ++i, arg));
    } else if (arg === "--offthread-video-threads") {
      renderSettings.offthreadVideoThreads = parsePositiveInteger(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--encoder") {
      renderSettings.encoder = parseEncoder(requireValue(rest, ++i, arg));
    } else if (arg === "--scale") {
      renderSettings.scale = parseScale(requireValue(rest, ++i, arg));
    } else if (arg === "--video-bitrate") {
      const bitrate = parseBitrate(requireValue(rest, ++i, arg), arg);
      renderSettings.videoBitrate = bitrate;
      renderSettings.crf = null;
      if (!explicitMaxRate) renderSettings.encodingMaxRate = bitrate;
      if (!explicitBufferSize) renderSettings.encodingBufferSize = doubleBitrate(bitrate);
    } else if (arg === "--maxrate") {
      renderSettings.encodingMaxRate = parseBitrate(requireValue(rest, ++i, arg), arg);
      explicitMaxRate = true;
    } else if (arg === "--bufsize") {
      renderSettings.encodingBufferSize = parseBitrate(requireValue(rest, ++i, arg), arg);
      explicitBufferSize = true;
    } else if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    } else {
      throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (maxDurationSeconds !== undefined) {
    const lastFrame = Math.max(0, Math.ceil(maxDurationSeconds * FPS) - 1);
    renderSettings.frameRange = [0, lastFrame];
  }

  if (renderSettings.encoder === "amf") {
    renderSettings.crf = null;
    renderSettings.videoBitrate = renderSettings.videoBitrate ?? DEFAULT_ABC_PREVIEW_VIDEO_BITRATE;
    renderSettings.encodingMaxRate = renderSettings.encodingMaxRate ?? renderSettings.videoBitrate;
    renderSettings.encodingBufferSize =
      renderSettings.encodingBufferSize ?? doubleBitrate(renderSettings.videoBitrate);
    renderSettings.x264Preset = null;
    renderSettings.hardwareAcceleration = renderSettings.hardwareAcceleration ?? "disable";
  }

  return {
    previewDir,
    output:
      output ??
      join(
        previewDir,
        maxDurationSeconds === undefined
          ? "abc-preview-landscape-4k.mp4"
          : `abc-preview-landscape-sample-${String(maxDurationSeconds).replace(".", "_")}s-1080p.mp4`,
      ),
    renderSettings,
    ...(maxDurationSeconds !== undefined && { maxDurationSeconds }),
  };
}

function repoRoot(): string {
  return fileURLToPath(new URL("../../..", import.meta.url));
}

function candidatePaths(path: string): string[] {
  if (isAbsolute(path) || WINDOWS_ABSOLUTE.test(path)) return [path];
  const bases = [
    repoRoot(),
    process.env.INIT_CWD,
    process.cwd(),
  ].filter((base): base is string => Boolean(base));
  return [...new Set(bases.map((base) => resolve(base, path)))];
}

function resolvePreviewDir(inputArg: string): string {
  for (const input of candidatePaths(inputArg)) {
    if (existsSync(input) && basename(input).toLowerCase() === "preview-data.json") {
      return dirname(input);
    }
    if (existsSync(join(input, "preview-data.json"))) {
      return input;
    }
    const nested = join(input, "video_preview");
    if (existsSync(join(nested, "preview-data.json"))) {
      return nested;
    }
  }
  throw new Error(
    `Could not find preview-data.json for input '${inputArg}'`,
  );
}

function resolveEntryPoint(): string {
  const candidates = [
    new URL("../dist/index.js", import.meta.url),
    new URL("./index.js", import.meta.url),
    new URL("./index.ts", import.meta.url),
  ].map((url) => fileURLToPath(url));
  return candidates.find((path) => existsSync(path)) ?? candidates[candidates.length - 1]!;
}

function renderFrameCount(
  composition: { durationInFrames?: unknown },
  frameRange: RemotionRenderSettings["frameRange"],
): number | null {
  const duration =
    typeof composition.durationInFrames === "number" && Number.isFinite(composition.durationInFrames)
      ? Math.max(0, Math.floor(composition.durationInFrames))
      : null;
  if (duration === null) return null;
  if (!Array.isArray(frameRange)) return duration;
  const start = Math.max(0, Math.floor(frameRange[0] ?? 0));
  const rawEnd = frameRange[1] === null ? duration - 1 : frameRange[1];
  const end =
    typeof rawEnd === "number" && Number.isFinite(rawEnd)
      ? Math.min(duration - 1, Math.floor(rawEnd))
      : duration - 1;
  return Math.max(0, end - start + 1);
}

function createProgressLogger(totalFrames: number | null): (progress: RenderProgress) => void {
  const startedAt = Date.now();
  let lastEmitAt = 0;
  let lastPercentBucket = -1;

  return (progress) => {
    const now = Date.now();
    const ratio = Math.max(0, Math.min(1, progress.progress || 0));
    const percent = Math.round(ratio * 1000) / 10;
    const percentBucket = Math.floor(percent);
    if (ratio < 1 && now - lastEmitAt < 1000 && percentBucket === lastPercentBucket) {
      return;
    }
    lastEmitAt = now;
    lastPercentBucket = percentBucket;
    const elapsedMs = now - startedAt;
    const etaMs = ratio > 0 && ratio < 1 ? Math.max(0, elapsedMs * (1 - ratio) / ratio) : 0;
    console.log(
      `${PROGRESS_PREFIX}${JSON.stringify({
        stage: progress.stitchStage,
        progress: ratio,
        percent,
        renderedFrames: progress.renderedFrames,
        encodedFrames: progress.encodedFrames,
        totalFrames,
        elapsedMs: Math.round(elapsedMs),
        etaMs: Math.round(etaMs),
        renderEstimatedTime: progress.renderEstimatedTime,
      })}`,
    );
  };
}

function decodePreviewPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sourcePathFromPreviewSrc(previewDir: string, src: string): string | null {
  if (!src || REMOTE_ASSET.test(src)) return null;
  if (FILE_URL.test(src)) return fileURLToPath(src);
  const decoded = decodePreviewPath(src);
  if (isAbsolute(decoded) || WINDOWS_ABSOLUTE.test(decoded)) return decoded;
  return resolve(previewDir, decoded);
}

function safeAssetName(index: number, sourcePath: string): string {
  const rawBase = basename(sourcePath) || `asset${extname(sourcePath)}`;
  const safeBase = rawBase.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${String(index).padStart(4, "0")}-${safeBase || "asset"}`;
}

async function stagePreviewData(
  previewDir: string,
  publicDir: string,
): Promise<AbcPreviewData> {
  const raw = JSON.parse(
    await readFile(join(previewDir, "preview-data.json"), "utf8"),
  ) as AbcPreviewData;
  const data = JSON.parse(JSON.stringify(raw)) as AbcPreviewData;
  const assetDir = join(publicDir, "abc-preview-assets");
  await mkdir(assetDir, { recursive: true });
  let counter = 0;

  const stageAsset = async (src: string | undefined, label: string): Promise<string> => {
    if (!src) return "";
    if (REMOTE_ASSET.test(src)) return src;
    const sourcePath = sourcePathFromPreviewSrc(previewDir, src);
    if (!sourcePath || !existsSync(sourcePath)) {
      throw new Error(`Missing ${label} asset: ${src}`);
    }
    counter += 1;
    const stagedName = safeAssetName(counter, sourcePath);
    await copyFile(sourcePath, join(assetDir, stagedName));
    return `abc-preview-assets/${stagedName}`;
  };

  data.assets.background = await stageAsset(data.assets.background, "background");
  data.assets.backgroundRender = await stageAsset(
    data.assets.backgroundRender,
    "render background",
  );
  data.assets.songLogo = await stageAsset(data.assets.songLogo, "song logo");
  data.assets.audio = await stageAsset(data.assets.audio, "audio");

  for (const [letter, assets] of Object.entries(data.letters)) {
    assets.letter.src = await stageAsset(assets.letter.src, `${letter} letter`);
    assets.object.src = await stageAsset(assets.object.src, `${letter} object`);
  }

  return data;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "--help" || rawArgs[0] === "-h") {
    console.log(usage());
    return;
  }

  const args = parseArgs(rawArgs);
  await mkdir(dirname(args.output), { recursive: true });

  const workDir = await mkdtemp(join(tmpdir(), "abc-preview-render-"));
  try {
    const publicDir = join(workDir, "public");
    await mkdir(publicDir, { recursive: true });
    const data = await stagePreviewData(args.previewDir, publicDir);
    const backend = createRemotionRenderBackend();
    const inputProps: Record<string, unknown> = {
      data,
    } satisfies AbcPreviewProps;

    console.log(`Bundling ${COMPOSITION_ID}...`);
    const serveUrl = await backend.bundle({
      entryPoint: resolveEntryPoint(),
      publicDir,
    });
    const composition = await backend.selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
    });
    const totalFrames = renderFrameCount(
      composition as { durationInFrames?: unknown },
      args.renderSettings.frameRange,
    );
    const onProgress = createProgressLogger(totalFrames);

    console.log(`Rendering ${args.output}...`);
    await backend.renderMedia({
      serveUrl,
      composition,
      outputLocation: args.output,
      inputProps,
      onProgress,
      ...args.renderSettings,
    });
    onProgress({
      renderedFrames: totalFrames ?? 0,
      encodedFrames: totalFrames ?? 0,
      encodedDoneIn: null,
      renderedDoneIn: null,
      renderEstimatedTime: 0,
      progress: 1,
      stitchStage: "muxing",
    });
    console.log(`Wrote ${args.output}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  for (let current: unknown = error, depth = 0; current; depth += 1) {
    const prefix = depth === 0 ? "" : "Caused by: ";
    if (current instanceof Error) {
      console.error(`${prefix}${current.message}`);
      current = current.cause;
    } else {
      console.error(`${prefix}${String(current)}`);
      break;
    }
  }
  process.exitCode = 1;
});
