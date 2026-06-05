import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  HtmlVideoOutputTarget,
  HtmlVideoStoryboard,
} from "../handoff/storyboard.js";
import { buildHtmlVideoDocument, projectAssetUrl } from "./template.js";

export interface HtmlVideoRenderOptions {
  projectDir: string;
  storyboardPath?: string;
  htmlVideoRoot?: string;
  outputDir?: string;
  targetId?: string;
  maxDuration?: number;
  muxAudio?: boolean;
  mode?: "frames" | "recorder";
  crf?: number;
}

export interface HtmlVideoRenderArtifact {
  targetId: string;
  htmlPath: string;
  videoOnlyPath?: string;
  outputPath: string;
  mode: "frames" | "recorder";
  duration: number;
  fileSizeBytes: number;
}

type HtmlVideoRenderFn = (
  input: {
    template: { id: string; engine: string; sourcePath: string };
    variables: Record<string, unknown>;
    config: {
      format: "mp4";
      resolution: { width: number; height: number };
      fps: number;
      duration: number;
      outputPath: string;
    };
  },
  context: {
    workDir: string;
    onProgress?: (pct: number, stage: string) => void;
  },
) => Promise<unknown>;

export async function renderHtmlVideoProject(
  options: HtmlVideoRenderOptions,
): Promise<HtmlVideoRenderArtifact[]> {
  const projectDir = resolve(options.projectDir);
  const storyboardPath =
    options.storyboardPath ?? join(projectDir, "artifacts", "html-video-storyboard.json");
  const storyboard = JSON.parse(
    await readFile(storyboardPath, "utf8"),
  ) as HtmlVideoStoryboard;
  const htmlVideoRoot = resolveHtmlVideoRoot(options.htmlVideoRoot);
  const mode = options.mode ?? "frames";
  const render = mode === "recorder" ? await loadHtmlVideoRender(htmlVideoRoot) : null;
  const targets = selectTargets(storyboard.outputTargets, options.targetId);
  const outputDir = resolve(options.outputDir ?? join(projectDir, "artifacts"));
  await mkdir(outputDir, { recursive: true });

  const artifacts: HtmlVideoRenderArtifact[] = [];
  for (const target of targets) {
    const duration = Math.max(
      0.5,
      Math.min(storyboard.duration, options.maxDuration ?? storyboard.duration),
    );
    const workDir = join(outputDir, "html-video-work", target.id);
    await mkdir(workDir, { recursive: true });

    const htmlPath = join(workDir, "index.html");
    const html = buildHtmlVideoDocument(storyboard, target, {
      projectDir,
      duration,
    });
    await writeFile(htmlPath, html, "utf8");

    const outputName = outputFileName(target, options.maxDuration);
    const outputPath = join(outputDir, outputName);
    const videoOnlyPath = join(workDir, outputName.replace(/\.mp4$/i, ".video-only.mp4"));

    if (mode === "recorder") {
      await render!(
        {
          template: {
            id: `music-visualizer-${target.id}`,
            engine: "hyperframes",
            sourcePath: htmlPath,
          },
          variables: {},
          config: {
            format: "mp4",
            resolution: { width: target.width, height: target.height },
            fps: target.fps,
            duration,
            outputPath: videoOnlyPath,
          },
        },
        {
          workDir,
          onProgress: (pct, stage) => {
            process.stdout.write(
              `[${target.id}] ${Math.round(pct).toString().padStart(3, " ")}% ${stage}\n`,
            );
          },
        },
      );

      if (options.muxAudio === false) {
        await copyVideoOnly(videoOnlyPath, outputPath);
      } else {
        await muxAudio({
          videoOnlyPath,
          audioPath: filePathFromProjectUrl(projectAssetUrl(projectDir, storyboard.assets.audio)),
          outputPath,
          duration,
        });
      }
    } else {
      await renderFrameSequence({
        htmlVideoRoot,
        htmlPath,
        target,
        workDir,
        outputPath,
        duration,
        crf: options.crf ?? 12,
        audioPath:
          options.muxAudio === false
            ? undefined
            : filePathFromProjectUrl(projectAssetUrl(projectDir, storyboard.assets.audio)),
      });
    }

    const fileStat = await stat(outputPath);
    artifacts.push({
      targetId: target.id,
      htmlPath,
      ...(mode === "recorder" && { videoOnlyPath }),
      outputPath,
      mode,
      duration,
      fileSizeBytes: fileStat.size,
    });
  }

  return artifacts;
}

function selectTargets(
  targets: HtmlVideoOutputTarget[],
  targetId: string | undefined,
): HtmlVideoOutputTarget[] {
  if (!targetId || targetId === "all") return targets;
  const target = targets.find((candidate) => candidate.id === targetId);
  if (!target) {
    throw new Error(
      `Unknown html-video target '${targetId}'. Available: ${targets
        .map((candidate) => candidate.id)
        .join(", ")}`,
    );
  }
  return [target];
}

function resolveHtmlVideoRoot(explicitRoot: string | undefined): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const candidates = [
    explicitRoot,
    process.env.HTML_VIDEO_ROOT,
    join(repoRoot, "..", "html-video"),
    join(process.cwd(), "..", "html-video"),
    join(repoRoot, "html-video"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const root = resolve(candidate);
    if (existsSync(join(root, "packages", "adapter-hyperframes", "dist", "index.js"))) {
      return root;
    }
  }

  return resolve(candidates[0] ?? join(repoRoot, "..", "html-video"));
}

async function loadHtmlVideoRender(htmlVideoRoot: string): Promise<HtmlVideoRenderFn> {
  const adapterPath = join(
    htmlVideoRoot,
    "packages",
    "adapter-hyperframes",
    "dist",
    "index.js",
  );
  const adapterModule = (await import(pathToFileURL(adapterPath).href)) as {
    render?: HtmlVideoRenderFn;
    adapter?: { render?: HtmlVideoRenderFn };
    default?: { render?: HtmlVideoRenderFn };
  };
  const render =
    adapterModule.render ?? adapterModule.adapter?.render ?? adapterModule.default?.render;
  if (!render) {
    throw new Error(
      `Could not load html-video Hyperframes renderer from ${adapterPath}. Run 'npx pnpm@9.15.0 build' in ${htmlVideoRoot}.`,
    );
  }
  return render;
}

interface PlaywrightModule {
  chromium: {
    launch(options: {
      headless: boolean;
      args?: string[];
    }): Promise<PlaywrightBrowser>;
  };
}

interface PlaywrightBrowser {
  newContext(options: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
  }): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightPage {
  goto(url: string, options: { waitUntil: "load" }): Promise<void>;
  evaluate<R, A = undefined>(
    pageFunction: string | ((arg: A) => R | Promise<R>),
    arg?: A,
  ): Promise<R>;
  screenshot(options: { type: "png" }): Promise<Buffer>;
}

interface FrameSequenceRenderOptions {
  htmlVideoRoot: string;
  htmlPath: string;
  target: HtmlVideoOutputTarget;
  workDir: string;
  outputPath: string;
  duration: number;
  audioPath?: string;
  crf: number;
}

async function renderFrameSequence(options: FrameSequenceRenderOptions): Promise<void> {
  const playwright = await loadPlaywright(options.htmlVideoRoot);
  const totalFrames = Math.ceil(options.duration * options.target.fps);
  const ffmpeg = spawnFfmpegForFrames({
    outputPath: options.outputPath,
    fps: options.target.fps,
    duration: options.duration,
    crf: options.crf,
    ...(options.audioPath !== undefined && { audioPath: options.audioPath }),
  });

  let browser: PlaywrightBrowser | null = null;
  let context: PlaywrightContext | null = null;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    });
    context = await browser.newContext({
      viewport: { width: options.target.width, height: options.target.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const url = `${pathToFileURL(options.htmlPath).href}?frame-render=1`;
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(
      "() => window.__MV_READY__ ?? Promise.resolve(true)",
    );

    const progressInterval = Math.max(1, Math.round(options.target.fps));
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / options.target.fps;
      await page.evaluate(
        "(t) => window.__MV_RENDER_AT__(t)",
        time,
      );
      const png = await page.screenshot({ type: "png" });
      await writeToStream(ffmpeg.stdin, png);

      if (frame === 0 || frame === totalFrames - 1 || frame % progressInterval === 0) {
        const pct = Math.round(((frame + 1) / totalFrames) * 100);
        process.stdout.write(
          `[${options.target.id}] ${pct.toString().padStart(3, " ")}% frame ${frame + 1}/${totalFrames}\n`,
        );
      }
    }

    ffmpeg.stdin.end();
    await ffmpeg.done;
  } catch (error) {
    ffmpeg.stdin.destroy();
    await ffmpeg.done.catch(() => undefined);
    throw error;
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function loadPlaywright(htmlVideoRoot: string): Promise<PlaywrightModule> {
  const requireFromAdapter = createRequire(
    join(htmlVideoRoot, "packages", "adapter-hyperframes", "package.json"),
  );
  const playwrightPath = requireFromAdapter.resolve("playwright");
  return (await import(pathToFileURL(playwrightPath).href)) as unknown as PlaywrightModule;
}

function spawnFfmpegForFrames(args: {
  outputPath: string;
  fps: number;
  duration: number;
  crf: number;
  audioPath?: string;
}): {
  stdin: Writable;
  done: Promise<void>;
} {
  const ffmpegArgs = [
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(args.fps),
    "-i",
    "pipe:0",
    ...(args.audioPath ? ["-i", args.audioPath] : []),
    "-t",
    String(args.duration),
    "-map",
    "0:v:0",
    ...(args.audioPath ? ["-map", "1:a:0"] : []),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "slow",
    "-tune",
    "animation",
    "-crf",
    String(args.crf),
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    ...(args.audioPath ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    "-movflags",
    "+faststart",
    args.outputPath,
  ];

  const child = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });
  if (!child.stdin) {
    throw new Error("Could not open ffmpeg stdin");
  }

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const done = new Promise<void>((resolveDone, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("ffmpeg not found on PATH"));
      } else {
        reject(error);
      }
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveDone();
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });

  return { stdin: child.stdin, done };
}

function writeToStream(stream: Writable, chunk: Buffer): Promise<void> {
  return new Promise((resolveWrite, reject) => {
    const onError = (error: Error) => {
      stream.off("drain", onDrain);
      reject(error);
    };
    const onDrain = () => {
      stream.off("error", onError);
      resolveWrite();
    };
    if (stream.write(chunk)) {
      resolveWrite();
      return;
    }
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

async function copyVideoOnly(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await run("ffmpeg", [
    "-y",
    "-i",
    source,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    destination,
  ]);
}

async function muxAudio(args: {
  videoOnlyPath: string;
  audioPath: string;
  outputPath: string;
  duration: number;
}): Promise<void> {
  await mkdir(dirname(args.outputPath), { recursive: true });
  await run("ffmpeg", [
    "-y",
    "-i",
    args.videoOnlyPath,
    "-i",
    args.audioPath,
    "-t",
    String(args.duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    args.outputPath,
  ]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`${command} not found on PATH`));
      } else {
        reject(error);
      }
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

function outputFileName(
  target: HtmlVideoOutputTarget,
  maxDuration: number | undefined,
): string {
  if (!maxDuration) return target.fileName;
  const suffix = `preview-${String(maxDuration).replace(/[^0-9a-z]+/gi, "-")}s`;
  return target.fileName.replace(/\.mp4$/i, `-${suffix}.mp4`);
}

function filePathFromProjectUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "file:") {
    throw new Error(`Expected file URL, got ${url}`);
  }
  return decodeURIComponent(parsed.pathname.replace(/^\/([A-Za-z]:\/)/, "$1"));
}
