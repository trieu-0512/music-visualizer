import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
}

export interface HtmlVideoRenderArtifact {
  targetId: string;
  htmlPath: string;
  videoOnlyPath: string;
  outputPath: string;
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
  const render = await loadHtmlVideoRender(htmlVideoRoot);
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

    await render(
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

    const fileStat = await stat(outputPath);
    artifacts.push({
      targetId: target.id,
      htmlPath,
      videoOnlyPath,
      outputPath,
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
