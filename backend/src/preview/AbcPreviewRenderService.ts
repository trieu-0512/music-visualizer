import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { availableParallelism, tmpdir } from "node:os";
import { workspaceRoot } from "@music-visualizer/shared/config";
import type { AssetStore } from "../storage/index.js";

const PROGRESS_PREFIX = "ABC_RENDER_PROGRESS ";
const PREVIEW_DATA_PATH = "artifacts/preview-data.json";
const DEFAULT_OFFTHREAD_VIDEO_THREADS = 2;
const DEFAULT_CONCURRENCY = recommendedConcurrency();
const DEFAULT_MAX_DURATION_SECONDS = undefined;

export type PreviewRenderStatus =
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export interface PreviewRenderOptions {
  /** Render only the first N seconds when set; omitted means the full song. */
  maxDurationSeconds?: number;
  /** Remotion renderer concurrency. */
  concurrency?: number;
  /** Full song output is 4K; samples stay Full HD unless explicitly changed. */
  resolution?: "fullhd" | "4k";
}

export interface PreviewRenderJob {
  id: string;
  projectId: string;
  status: PreviewRenderStatus;
  progress: number;
  percent: number;
  stage: string;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number | null;
  elapsedMs: number;
  etaMs: number;
  createdAt: string;
  updatedAt: string;
  outputPath: string;
  maxDurationSeconds?: number;
  error?: string;
}

export interface PreviewRenderServiceApi {
  start(projectId: string, options: PreviewRenderOptions): Promise<PreviewRenderJob>;
  getActive(projectId: string): PreviewRenderJob | null;
  get(projectId: string, jobId: string): PreviewRenderJob | null;
  cancel(projectId: string, jobId: string): Promise<PreviewRenderJob | null>;
}

export interface ParsedAbcProgress {
  stage: string;
  progress: number;
  percent: number;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number | null;
  elapsedMs: number;
  etaMs: number;
}

/** Parse one machine-readable line emitted by the ABC Remotion CLI. */
export function parseAbcProgressLine(line: string): ParsedAbcProgress | null {
  const marker = line.indexOf(PROGRESS_PREFIX);
  if (marker < 0) return null;
  const raw = line.slice(marker + PROGRESS_PREFIX.length).trim();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const progress = clamp01(numberOr(value.progress, 0));
    return {
      stage: stringOr(value.stage, "rendering"),
      progress,
      percent: numberOr(value.percent, Math.round(progress * 1000) / 10),
      renderedFrames: nonNegativeIntOr(value.renderedFrames, 0),
      encodedFrames: nonNegativeIntOr(value.encodedFrames, 0),
      totalFrames:
        value.totalFrames === null
          ? null
          : nonNegativeIntOr(value.totalFrames, 0),
      elapsedMs: nonNegativeIntOr(value.elapsedMs, 0),
      etaMs: nonNegativeIntOr(value.etaMs, 0),
    };
  } catch {
    return null;
  }
}

export class PreviewRenderBusyError extends Error {
  constructor(projectId: string) {
    super(`A preview render is already running for project '${projectId}'`);
    this.name = "PreviewRenderBusyError";
  }
}

export interface PreviewRenderServiceOptions {
  spawnProcess?: typeof spawn;
  cwd?: string;
  tempRoot?: string;
  now?: () => Date;
}

interface InternalJob extends PreviewRenderJob {
  child?: ChildProcess;
  tempDir: string;
  stderr: string;
  stdoutRemainder: string;
  finishing: boolean;
  cancelRequested: boolean;
}

/**
 * Runs the existing Remotion ABC CLI behind a small local API boundary.
 *
 * Keeping the renderer in a child process prevents Chromium/FFmpeg work from
 * blocking Express, while stdout's structured progress lines provide the UI
 * with real percent and ETA values. The normalized preview JSON uses absolute
 * local asset paths, so the CLI consumes the exact files used by the browser.
 */
export class AbcPreviewRenderService implements PreviewRenderServiceApi {
  private readonly jobs = new Map<string, InternalJob>();
  private readonly spawnProcess: typeof spawn;
  private readonly cwd: string;
  private readonly tempRoot: string;
  private readonly now: () => Date;

  constructor(
    private readonly store: AssetStore,
    options: PreviewRenderServiceOptions = {},
  ) {
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.cwd = options.cwd ?? workspaceRoot();
    this.tempRoot = options.tempRoot ?? tmpdir();
    this.now = options.now ?? (() => new Date());
  }

  getActive(projectId: string): PreviewRenderJob | null {
    for (const job of this.jobs.values()) {
      if (
        job.projectId === projectId &&
        (job.status === "running" || job.status === "cancelling")
      ) {
        return toPublic(job);
      }
    }
    return null;
  }

  get(projectId: string, jobId: string): PreviewRenderJob | null {
    const job = this.jobs.get(jobId);
    if (!job || job.projectId !== projectId) return null;
    return toPublic(job);
  }

  async start(
    projectId: string,
    options: PreviewRenderOptions = {},
  ): Promise<PreviewRenderJob> {
    if (this.getActive(projectId)) throw new PreviewRenderBusyError(projectId);

    const previewRef = { projectId, relativePath: PREVIEW_DATA_PATH };
    if (!(await this.store.exists(previewRef))) {
      throw new Error("Preview data has not been prepared for this project");
    }

    const previewData = await this.readAndResolvePreviewData(projectId);
    const tempDir = await mkdtemp(join(this.tempRoot, "mv-abc-preview-"));
    const previewPath = join(tempDir, "preview-data.json");
    const resolution =
      options.resolution ??
      (options.maxDurationSeconds === undefined ? "4k" : "fullhd");
    const outputPath = this.outputPath(options.maxDurationSeconds, resolution);
    const outputAbsolute = await this.store.resolveUrl({
      projectId,
      relativePath: outputPath,
    });
    await writeFile(previewPath, JSON.stringify(previewData), "utf8");

    const timestamp = this.now().toISOString();
    const job: InternalJob = {
      id: randomUUID(),
      projectId,
      status: "running",
      progress: 0,
      percent: 0,
      stage: "starting",
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames: null,
      elapsedMs: 0,
      etaMs: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      outputPath,
      ...(options.maxDurationSeconds !== undefined
        ? { maxDurationSeconds: options.maxDurationSeconds }
        : {}),
      tempDir,
      stderr: "",
      stdoutRemainder: "",
      finishing: false,
      cancelRequested: false,
    };
    this.jobs.set(job.id, job);

    const args = this.cliArgs(
      previewPath,
      outputAbsolute,
      options.maxDurationSeconds,
      options.concurrency ?? DEFAULT_CONCURRENCY,
      resolution,
    );
    let child: ChildProcess;
    try {
      child = this.spawnProcess(this.npmCommand(), args, this.spawnOptions());
    } catch (error) {
      await this.finish(job, "failed", errorMessage(error));
      return toPublic(job);
    }
    job.child = child;
    child.stdout?.on("data", (chunk: Buffer | string) => {
      this.consumeStdout(job, String(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      job.stderr = `${job.stderr}${String(chunk)}`.slice(-8_000);
    });
    child.once("error", (error) => {
      void this.finish(job, job.cancelRequested ? "cancelled" : "failed", errorMessage(error));
    });
    child.once("close", (code, signal) => {
      if (job.cancelRequested) {
        void this.finish(job, "cancelled", "Render cancelled by user");
      } else if (code === 0) {
        void this.finish(job, "completed");
      } else {
        const suffix = signal ? ` (signal ${signal})` : "";
        void this.finish(
          job,
          "failed",
          `Remotion render exited with code ${String(code)}${suffix}${job.stderr ? `: ${job.stderr.trim()}` : ""}`,
        );
      }
    });
    return toPublic(job);
  }

  async cancel(projectId: string, jobId: string): Promise<PreviewRenderJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.projectId !== projectId) return null;
    if (job.status !== "running") return toPublic(job);
    job.cancelRequested = true;
    job.status = "cancelling";
    this.touch(job);
    try {
      const child = job.child;
      if (process.platform === "win32" && child?.pid) {
        // npm.cmd can leave Chromium/FFmpeg descendants behind; terminate the
        // process tree before killing the shim itself so taskkill can still
        // resolve the root PID.
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.once("close", () => {
          if (!child.killed) child.kill("SIGTERM");
        });
        killer.unref();
      } else {
        child?.kill("SIGTERM");
      }
    } catch {
      // The close/error event will still settle the job when the child exits.
    }
    return toPublic(job);
  }

  private async readAndResolvePreviewData(projectId: string): Promise<unknown> {
    const raw = await this.store.read({ projectId, relativePath: PREVIEW_DATA_PATH });
    const parsed = JSON.parse(raw.toString("utf8")) as unknown;
    if (!isRecord(parsed)) throw new Error("Preview data must be a JSON object");
    const data = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;

    if (isRecord(data.assets)) {
      for (const key of ["background", "backgroundRender", "songLogo", "audio"]) {
        const value = data.assets[key];
        if (typeof value === "string") {
          data.assets[key] = await this.resolveAsset(projectId, value);
        }
      }
    }
    if (isRecord(data.letters)) {
      for (const pair of Object.values(data.letters)) {
        if (!isRecord(pair)) continue;
        for (const key of ["letter", "object"]) {
          const asset = pair[key];
          if (isRecord(asset) && typeof asset.src === "string") {
            asset.src = await this.resolveAsset(projectId, asset.src);
          }
        }
      }
    }
    return data;
  }

  private async resolveAsset(projectId: string, source: string): Promise<string> {
    if (
      /^(https?:)?\/\//i.test(source) ||
      /^(data|blob|file):/i.test(source) ||
      isAbsolute(source) ||
      /^[a-zA-Z]:[\\/]/.test(source)
    ) {
      return source;
    }
    return this.store.resolveUrl({ projectId, relativePath: source });
  }

  private outputPath(
    maxDurationSeconds: number | undefined,
    resolution: "fullhd" | "4k",
  ): string {
    if (maxDurationSeconds === DEFAULT_MAX_DURATION_SECONDS) {
      return `artifacts/abc-preview-landscape-${resolution}.mp4`;
    }
    const label = String(maxDurationSeconds).replace(/\./g, "_");
    return `artifacts/abc-preview-sample-${label}s-${resolution}.mp4`;
  }

  private cliArgs(
    previewPath: string,
    outputPath: string,
    maxDurationSeconds: number | undefined,
    concurrency: number,
    resolution: "fullhd" | "4k",
  ): string[] {
    const npmArgs = [
      "run",
      "render:abc-preview",
      "--workspace",
      "@music-visualizer/remotion",
      "--",
      previewPath,
      "--output",
      outputPath,
      "--crf",
      "18",
      "--x264-preset",
      "fast",
      "--concurrency",
      String(concurrency),
      "--offthread-video-threads",
      String(DEFAULT_OFFTHREAD_VIDEO_THREADS),
      "--scale",
      resolution === "4k" ? "2" : "1",
      "--gl",
      "angle",
      "--hardware-acceleration",
      "disable",
    ];
    if (maxDurationSeconds !== undefined) {
      npmArgs.push("--max-duration", String(maxDurationSeconds));
    }
    if (process.platform === "win32") {
      return ["/d", "/s", "/c", "npm.cmd", ...npmArgs];
    }
    return npmArgs;
  }

  private npmCommand(): string {
    return process.platform === "win32"
      ? process.env.ComSpec ?? "cmd.exe"
      : "npm";
  }

  private spawnOptions(): SpawnOptions {
    return {
      cwd: this.cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    };
  }

  private consumeStdout(job: InternalJob, chunk: string): void {
    const lines = `${job.stdoutRemainder}${chunk}`.split(/\r?\n/);
    job.stdoutRemainder = lines.pop() ?? "";
    for (const line of lines) {
      const progress = parseAbcProgressLine(line);
      if (!progress) continue;
      job.progress = progress.progress;
      job.percent = progress.percent;
      job.stage = progress.stage;
      job.renderedFrames = progress.renderedFrames;
      job.encodedFrames = progress.encodedFrames;
      job.totalFrames = progress.totalFrames;
      job.elapsedMs = progress.elapsedMs;
      job.etaMs = progress.etaMs;
      this.touch(job);
    }
  }

  private async finish(
    job: InternalJob,
    status: Extract<PreviewRenderStatus, "completed" | "failed" | "cancelled">,
    error?: string,
  ): Promise<void> {
    if (job.finishing) return;
    job.finishing = true;
    if (status === "completed" && !(await this.store.exists({ projectId: job.projectId, relativePath: job.outputPath }))) {
      status = "failed";
      error = "Remotion exited successfully but did not produce an MP4 output";
    }
    job.status = status;
    job.stage = status;
    if (status === "completed") {
      job.progress = 1;
      job.percent = 100;
      job.etaMs = 0;
    }
    if (error) job.error = error;
    this.touch(job);
    await rm(job.tempDir, { recursive: true, force: true });
  }

  private touch(job: InternalJob): void {
    job.updatedAt = this.now().toISOString();
  }
}

function toPublic(job: InternalJob): PreviewRenderJob {
  const {
    child: _child,
    tempDir: _tempDir,
    stderr: _stderr,
    stdoutRemainder: _stdoutRemainder,
    finishing: _finishing,
    cancelRequested: _cancelRequested,
    ...publicJob
  } = job;
  return { ...publicJob };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeIntOr(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(numberOr(value, fallback)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keep Chromium and FFmpeg from saturating the rest of the desktop. */
export function recommendedConcurrencyFor(logicalCores: number): number {
  const cores = Number.isFinite(logicalCores) ? Math.max(1, Math.floor(logicalCores)) : 1;
  return Math.max(1, Math.min(2, Math.floor(cores / 4) || 1));
}

function recommendedConcurrency(): number {
  try {
    return recommendedConcurrencyFor(availableParallelism());
  } catch {
    return 1;
  }
}
