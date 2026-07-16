import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { validateProjectConfig, type ProjectConfigJson } from "@music-visualizer/shared";

import {
  DEFAULT_REMOTION_RENDER_SETTINGS,
  renderProject,
  type AssetRef,
  type Bitrate,
  type ChromeMode,
  type EncoderMode,
  type HardwareAccelerationMode,
  type OpenGlRenderer,
  type RemotionRenderSettings,
  type RenderAssetStore,
  type RenderTargetSelector,
} from "./render.js";
import { FPS } from "./defaultProps.js";

const execFileAsync = promisify(execFile);

interface CliArgs {
  projectDir: string;
  targetSelectors: RenderTargetSelector[];
  renderSettings: RemotionRenderSettings;
  outputTag?: string;
}

class ProjectDirectoryStore implements RenderAssetStore {
  constructor(private readonly projectDir: string) {}

  private absolutePath(ref: AssetRef): string {
    const absolute = resolve(this.projectDir, ref.relativePath);
    if (absolute !== this.projectDir && !absolute.startsWith(`${this.projectDir}${sep}`)) {
      throw new Error(`Ref escapes project directory: ${ref.relativePath}`);
    }
    return absolute;
  }

  async read(ref: AssetRef): Promise<Buffer> {
    return readFile(this.absolutePath(ref));
  }

  async write(ref: AssetRef, data: Buffer): Promise<void> {
    const target = this.absolutePath(ref);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async delete(ref: AssetRef): Promise<void> {
    await rm(this.absolutePath(ref), { force: true });
  }

  async exists(ref: AssetRef): Promise<boolean> {
    return existsSync(this.absolutePath(ref));
  }
}

function usage(): string {
  return [
    "Usage: npm run render:remotion -- <project-dir> [options]",
    "",
    "Options:",
    "  --target <id|quality|all>   e.g. landscape-fullhd, landscape-4k, fullhd, 4k (default: all targets from videoFormat)",
    "  --max-duration <seconds>    Render only the first N seconds and write a sample-* file",
    "  --output-tag <tag>          Append a tag before .mp4 (default with --max-duration: sample-Ns)",
    "  --encoder <amf|x264>        H.264 encoder (default: amf for this CLI)",
    "  --binaries-directory <dir>  Directory containing remotion.exe + FFmpeg binaries",
    `  --crf <1..51>               x264 CRF; implies --encoder x264 unless encoder is explicit (default x264 CRF: ${DEFAULT_REMOTION_RENDER_SETTINGS.crf})`,
    "  --video-bitrate <rate>      Fixed H.264 bitrate, e.g. 25M; disables CRF; AMF auto-picks if omitted",
    "  --maxrate <rate>            FFmpeg encodingMaxRate, e.g. 25M",
    "  --bufsize <rate>            FFmpeg encodingBufferSize, e.g. 50M",
    `  --x264-preset <preset>      ultrafast..placebo (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.x264Preset})`,
    `  --concurrency <n|percent>   Remotion render concurrency (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.concurrency})`,
    `  --offthread-video-threads <n> OffthreadVideo decode threads (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.offthreadVideoThreads})`,
    "  --hardware-acceleration <disable|if-possible|required> (default: disable with AMF, if-possible with x264)",
    `  --chrome-mode <headless-shell|chrome-for-testing> (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.chromeMode})`,
    `  --gl <angle|vulkan|egl|angle-egl|swangle|swiftshader> Chromium GL backend (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.gl})`,
    `  --audio-bitrate <rate>      AAC bitrate (default: ${DEFAULT_REMOTION_RENDER_SETTINGS.audioBitrate})`,
  ].join("\n");
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseCrf(value: string): number {
  const crf = Number(value);
  if (!Number.isInteger(crf) || crf < 1 || crf > 51) {
    throw new Error(`Invalid CRF '${value}'. Expected integer 1..51.`);
  }
  return crf;
}

function parseBitrate(value: string, flag: string): Bitrate {
  if (!/^\d+(?:\.\d+)?[kKM]$/.test(value)) {
    throw new Error(`Invalid ${flag} '${value}'. Expected values like 192k, 25M, or 80M.`);
  }
  return value as Bitrate;
}

function parsePositiveSeconds(value: string, flag: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid ${flag} '${value}'. Expected a positive number of seconds.`);
  }
  return seconds;
}

function parseEncoder(value: string): EncoderMode {
  if (value !== "amf" && value !== "x264") {
    throw new Error(`Invalid --encoder '${value}'. Expected amf or x264.`);
  }
  return value;
}

function parseHardwareAcceleration(value: string): HardwareAccelerationMode {
  if (value !== "disable" && value !== "if-possible" && value !== "required") {
    throw new Error(
      `Invalid --hardware-acceleration '${value}'. Expected disable, if-possible, or required.`,
    );
  }
  return value;
}

function parseChromeMode(value: string): ChromeMode {
  if (value !== "headless-shell" && value !== "chrome-for-testing") {
    throw new Error(
      `Invalid --chrome-mode '${value}'. Expected headless-shell or chrome-for-testing.`,
    );
  }
  return value;
}

function parseOpenGlRenderer(value: string): OpenGlRenderer {
  const values = ["swangle", "angle", "egl", "swiftshader", "vulkan", "angle-egl"];
  if (!values.includes(value)) {
    throw new Error(
      `Invalid --gl '${value}'. Expected ${values.join(", ")}.`,
    );
  }
  return value as OpenGlRenderer;
}

function parseTarget(value: string): RenderTargetSelector[] {
  if (value === "all") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean) as RenderTargetSelector[];
}

function resolveCliPath(path: string): string {
  if (isAbsolute(path)) return path;
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    const fromInitialCwd = resolve(initCwd, path);
    if (existsSync(fromInitialCwd)) return fromInitialCwd;
  }
  return resolve(path);
}

async function copyIfChanged(source: string, target: string): Promise<void> {
  try {
    const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)]);
    if (sourceStat.size === targetStat.size && sourceStat.mtimeMs <= targetStat.mtimeMs) {
      return;
    }
  } catch {
    // Missing target or unreadable metadata: copy below.
  }
  await copyFile(source, target);
}

function isBundledRemotionBinary(path: string): boolean {
  const normalized = path.toLowerCase().replace(/\//g, "\\");
  return (
    normalized.includes("\\node_modules\\@remotion\\compositor-") ||
    normalized.includes("\\storage\\.remotion-amf-binaries\\")
  );
}

async function findExecutableOnPath(name: string): Promise<string> {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const { stdout } = await execFileAsync(command, [name], { windowsHide: true });
  const candidates = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const preferred = candidates.find((candidate) => !isBundledRemotionBinary(candidate));
  const resolvedPath = preferred ?? candidates[0];
  if (!resolvedPath) {
    throw new Error(`Could not find ${name} on PATH.`);
  }
  return resolvedPath;
}

async function resolveSystemFfmpegBinaries(): Promise<{
  ffmpeg: string;
  ffprobe: string;
}> {
  const envDir = process.env.FFMPEG_BIN_DIR;
  if (envDir) {
    const dir = resolve(envDir);
    const ffmpeg = join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
    const ffprobe = join(dir, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
    if (existsSync(ffmpeg) && existsSync(ffprobe)) {
      return { ffmpeg, ffprobe };
    }
    throw new Error(
      `FFMPEG_BIN_DIR is set to '${envDir}', but ffmpeg/ffprobe were not both found there.`,
    );
  }

  const ffmpeg = await findExecutableOnPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const ffprobeInSameDir = join(
    dirname(ffmpeg),
    process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
  );
  const ffprobe = existsSync(ffprobeInSameDir)
    ? ffprobeInSameDir
    : await findExecutableOnPath(process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  return { ffmpeg, ffprobe };
}

async function ensureAmfBinariesDirectory(): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("AMD AMF encoding is only wired for Windows in this CLI. Use --encoder x264 on this platform.");
  }

  const bundledDir = fileURLToPath(
    new URL("../../node_modules/@remotion/compositor-win32-x64-msvc/", import.meta.url),
  );
  if (!existsSync(join(bundledDir, "remotion.exe"))) {
    throw new Error(`Could not find Remotion compositor binaries at ${bundledDir}.`);
  }

  const targetDir = fileURLToPath(new URL("../../storage/.remotion-amf-binaries/", import.meta.url));
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(bundledDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await copyIfChanged(join(bundledDir, entry.name), join(targetDir, entry.name));
  }

  const { ffmpeg, ffprobe } = await resolveSystemFfmpegBinaries();
  await copyIfChanged(ffmpeg, join(targetDir, "ffmpeg.exe"));
  await copyIfChanged(ffprobe, join(targetDir, "ffprobe.exe"));
  return targetDir;
}

function parseArgs(argv: string[]): CliArgs {
  const [projectArg, ...rest] = argv;
  if (!projectArg) {
    throw new Error(usage());
  }

  const renderSettings: RemotionRenderSettings = { encoder: "amf" };
  let targetSelectors: RenderTargetSelector[] = [];
  let maxDurationSeconds: number | undefined;
  let outputTag: string | undefined;
  let explicitEncoder = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--target") {
      targetSelectors = parseTarget(requireValue(rest, ++i, arg));
    } else if (arg === "--max-duration") {
      maxDurationSeconds = parsePositiveSeconds(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--output-tag") {
      outputTag = requireValue(rest, ++i, arg);
    } else if (arg === "--encoder") {
      renderSettings.encoder = parseEncoder(requireValue(rest, ++i, arg));
      explicitEncoder = true;
    } else if (arg === "--binaries-directory") {
      renderSettings.binariesDirectory = resolveCliPath(requireValue(rest, ++i, arg));
    } else if (arg === "--crf") {
      renderSettings.crf = parseCrf(requireValue(rest, ++i, arg));
    } else if (arg === "--video-bitrate") {
      renderSettings.videoBitrate = parseBitrate(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--maxrate") {
      renderSettings.encodingMaxRate = parseBitrate(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--bufsize") {
      renderSettings.encodingBufferSize = parseBitrate(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--x264-preset") {
      renderSettings.x264Preset = requireValue(rest, ++i, arg) as RemotionRenderSettings["x264Preset"];
    } else if (arg === "--concurrency") {
      const value = requireValue(rest, ++i, arg);
      renderSettings.concurrency = value.endsWith("%") ? value : Number(value);
      if (
        typeof renderSettings.concurrency === "number" &&
        (!Number.isFinite(renderSettings.concurrency) || renderSettings.concurrency <= 0)
      ) {
        throw new Error(`Invalid concurrency '${value}'.`);
      }
    } else if (arg === "--offthread-video-threads") {
      const value = Number(requireValue(rest, ++i, arg));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --offthread-video-threads '${value}'.`);
      }
      renderSettings.offthreadVideoThreads = value;
    } else if (arg === "--hardware-acceleration") {
      renderSettings.hardwareAcceleration = parseHardwareAcceleration(
        requireValue(rest, ++i, arg),
      );
    } else if (arg === "--chrome-mode") {
      renderSettings.chromeMode = parseChromeMode(requireValue(rest, ++i, arg));
    } else if (arg === "--gl") {
      renderSettings.gl = parseOpenGlRenderer(requireValue(rest, ++i, arg));
    } else if (arg === "--audio-bitrate") {
      renderSettings.audioBitrate = parseBitrate(requireValue(rest, ++i, arg), arg);
    } else if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    } else {
      throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (renderSettings.encodingMaxRate && !renderSettings.encodingBufferSize) {
    throw new Error("--maxrate requires --bufsize.");
  }

  if (renderSettings.crf !== undefined && !explicitEncoder) {
    renderSettings.encoder = "x264";
  }

  if (renderSettings.encoder === "amf" && renderSettings.crf !== undefined) {
    throw new Error("--crf is not supported with --encoder amf. Use --video-bitrate or omit both for AMF auto bitrate.");
  }

  if (renderSettings.videoBitrate) {
    renderSettings.crf = null;
  }

  if (maxDurationSeconds !== undefined) {
    const lastFrame = Math.max(0, Math.ceil(maxDurationSeconds * FPS) - 1);
    renderSettings.frameRange = [0, lastFrame];
    outputTag ??= `sample-${maxDurationSeconds.toString().replace(".", "_")}s`;
  }

  return {
    projectDir: resolveCliPath(projectArg),
    targetSelectors,
    renderSettings,
    ...(outputTag !== undefined && { outputTag }),
  };
}

async function readProjectConfig(projectDir: string): Promise<ProjectConfigJson> {
  const candidates = [
    join(projectDir, "project-config.json"),
    join(projectDir, "artifacts", "project-config.json"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(await readFile(candidate, "utf8")) as unknown;
    const result = validateProjectConfig(parsed);
    if (!result.ok) {
      throw new Error(`${candidate} is not a valid project config: ${JSON.stringify(result.error)}`);
    }
    return result.value;
  }
  throw new Error(
    `Could not find project-config.json in ${projectDir} or ${join(projectDir, "artifacts")}`,
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

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "--help" || rawArgs[0] === "-h") {
    console.log(usage());
    return;
  }

  const args = parseArgs(rawArgs);
  if (args.renderSettings.encoder === "amf" && !args.renderSettings.binariesDirectory) {
    args.renderSettings.binariesDirectory = await ensureAmfBinariesDirectory();
    console.log(`Using AMD AMF FFmpeg binaries from ${args.renderSettings.binariesDirectory}`);
  }
  const config = await readProjectConfig(args.projectDir);
  const store = new ProjectDirectoryStore(args.projectDir);
  const entryPoint = resolveEntryPoint();

  console.log(
    `Rendering ${config.projectId} with Remotion (${args.targetSelectors.length > 0 ? args.targetSelectors.join(", ") : config.videoFormat})...`,
  );
  const produced = await renderProject(config, store, {
    entryPoint,
    targetSelectors: args.targetSelectors,
    renderSettings: args.renderSettings,
    outputTag: args.outputTag,
  });
  for (const artifact of produced) {
    console.log(`Wrote ${join(args.projectDir, artifact)}`);
  }
}

main().catch((error: unknown) => {
  for (let current: unknown = error, depth = 0; current; depth++) {
    const prefix = depth === 0 ? "" : `Caused by: `;
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
