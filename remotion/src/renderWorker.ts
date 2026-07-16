/**
 * Render worker claim loop for the Render_Engine (task 10.6).
 *
 * This is the Render_Engine counterpart of the Python Audio_Worker loop
 * (`workers/src/worker.py`): a long-running loop that claims `render` jobs from
 * the Job_Queue, turns each into final MP4s, and records the outcome on the job.
 *
 * For a claimed render job the worker:
 *   1. reads the project's `artifacts/project-config.json` through the store and
 *      validates it with the shared {@link validateProjectConfig} validator,
 *   2. invokes {@link renderProject} to produce the configured 60fps
 *      landscape/portrait outputs and store them under the project,
 *   3. marks the job completed with the produced artifact paths (Req 9.1).
 *
 * Any failure — an unreadable/invalid config, or a {@link RenderError} thrown by
 * the render pipeline — is caught and recorded via `markFailed` with a
 * descriptive message so the queue retains the error (Req 9.6), rather than
 * crashing the loop.
 *
 * ## Decoupling and testability
 *
 * Like `render.ts`'s {@link RenderAssetStore}, the queue dependency is declared
 * as a minimal **structural** interface ({@link RenderJobQueue}) rather than
 * importing the backend's `JobQueue`/`FileJobQueue`. The Render_Engine therefore
 * stays decoupled from the backend package; the concrete `FileJobQueue` and
 * `LocalAssetStore` satisfy these interfaces structurally and are wired in by
 * the deliverables task (see the wiring note on {@link runRenderWorker}).
 *
 * `renderProject`, the queue/store, the stop predicate, the poll interval, and
 * the sleep function are all injectable, so the loop can be exercised in unit
 * tests with fakes and never launches Chromium.
 */
import { Buffer } from "node:buffer";

import {
  validateProjectConfig,
  type ProjectConfigJson,
} from "@music-visualizer/shared";

import type { VideoFormat } from "@music-visualizer/shared";

import {
  renderProject as defaultRenderProject,
  type RenderAssetStore,
  type RenderProjectDeps,
} from "./render.js";

/* -------------------------------------------------------------------------- */
/* Queue seam                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The minimal view of a Job_Queue job the render worker needs.
 *
 * The backend `Job` satisfies this structurally, so a claimed `Job` is passed
 * through unchanged.
 */
export interface RenderJob {
  /** Job id, used to record completion/failure. */
  id: string;
  /** Owning project; addresses the config + assets in the store. */
  projectId: string;
  /** Job type (always `"render"` for jobs this worker claims). */
  type: string;
  /**
   * Caller-supplied params. For render jobs the UI sends `{ format: VideoFormat }`
   * which overrides `config.videoFormat` for this job only (KD-6).
   */
  params?: Record<string, unknown>;
  /** Set by hybrid claim (fencing). */
  claimedBy?: string;
  claimGeneration?: number;
}

export interface RenderClaimOptions {
  workerId: string;
}

export interface RenderOwnershipOpts {
  workerId: string;
  claimGeneration: number;
}

/**
 * The minimal subset of the Job_Queue this worker drives (Req 9.1, 9.6).
 *
 * Declared locally (rather than importing the backend `JobQueue`) so the
 * Render_Engine stays decoupled from the backend package. The backend
 * `FileJobQueue` satisfies this structurally.
 */
export interface RenderJobQueue {
  /** Atomically claim the oldest pending job whose type is in `types`. */
  claimNext(types: string[], opts: RenderClaimOptions): Promise<RenderJob | null>;
  /** Ownership-fenced completion (Req 9.1, 12.3). */
  markCompleted(
    jobId: string,
    artifacts: string[],
    opts: RenderOwnershipOpts,
  ): Promise<unknown>;
  /** Ownership-fenced failure (Req 9.6, 12.4). */
  markFailed(
    jobId: string,
    error: string,
    opts: RenderOwnershipOpts,
  ): Promise<unknown>;
  /** Optional heartbeat for long renders (PR-04c). */
  heartbeat?(jobId: string, opts: RenderOwnershipOpts): Promise<unknown>;
  /** Boot / opportunistic recover (PR-04b). */
  recoverStale?(opts?: { now?: Date }): Promise<unknown>;
}

/** The {@link renderProject} contract the worker depends on (injectable for tests). */
export type RenderProjectFn = (
  config: ProjectConfigJson,
  store: RenderAssetStore,
  deps?: RenderProjectDeps,
) => Promise<string[]>;

const VIDEO_FORMATS = new Set<VideoFormat>(["landscape", "portrait", "both"]);

/** Parse a job-scoped format override from job params; invalid values are ignored. */
export function formatOverrideFromParams(
  params: Record<string, unknown> | undefined,
): VideoFormat | undefined {
  const format = params?.format;
  if (typeof format === "string" && VIDEO_FORMATS.has(format as VideoFormat)) {
    return format as VideoFormat;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Job types this worker claims. Render jobs only (Req 9.1). */
export const RENDER_JOB_TYPES: readonly string[] = ["render"];

/** Seconds (ms) to sleep when no render job is claimable, before polling again. */
export const POLL_INTERVAL_MS = 1000;

/**
 * Standardized location of the config artifact within a project, matching the
 * Config_Builder's `CONFIG_PATH`. The worker reads this for each claimed job.
 */
export const CONFIG_RELATIVE_PATH = "artifacts/project-config.json";

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/** Raised when a job's `project-config.json` cannot be loaded/validated (Req 9.6). */
export class RenderWorkerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RenderWorkerError";
  }
}

/* -------------------------------------------------------------------------- */
/* Config loading                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read and validate the project's `project-config.json` through the store.
 *
 * @throws {@link RenderWorkerError} when the config is unreadable, not valid
 *         JSON, or fails {@link validateProjectConfig}.
 */
async function loadProjectConfig(
  store: RenderAssetStore,
  projectId: string,
  relativePath: string,
): Promise<ProjectConfigJson> {
  let raw: Buffer;
  try {
    raw = await store.read({ projectId, relativePath });
  } catch (cause) {
    throw new RenderWorkerError(
      `Failed to read project-config.json at '${relativePath}' for project '${projectId}'`,
      { cause },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (cause) {
    throw new RenderWorkerError(
      `project-config.json at '${relativePath}' for project '${projectId}' is not valid JSON`,
      { cause },
    );
  }

  const result = validateProjectConfig(parsed);
  if (!result.ok) {
    throw new RenderWorkerError(
      `project-config.json for project '${projectId}' is not a valid project config: ${JSON.stringify(result.error)}`,
    );
  }
  return result.value;
}

/** Best-effort message extraction for the failure record (Req 9.6). */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/* -------------------------------------------------------------------------- */
/* Job processing                                                             */
/* -------------------------------------------------------------------------- */

/** Options for {@link processRenderJob} and {@link runRenderWorker}. */
export interface RenderWorkerDeps {
  /** Render implementation. Defaults to the real {@link renderProject}. */
  renderProject?: RenderProjectFn;
  /** Location of the config artifact. Defaults to {@link CONFIG_RELATIVE_PATH}. */
  configPath?: string;
  /** Heartbeat interval ms; 0 disables. Defaults to 15_000. */
  heartbeatIntervalMs?: number;
}

function ownershipFromJob(job: RenderJob, workerId: string): RenderOwnershipOpts {
  return {
    workerId: job.claimedBy ?? workerId,
    claimGeneration: job.claimGeneration ?? 0,
  };
}

/**
 * Process a single claimed render job, recording success or failure on it.
 *
 * Loads + validates the project's config, invokes `renderProject`, and on
 * success marks the job completed with the produced artifacts (Req 9.1). Any
 * thrown error (config load/validation or {@link RenderError} from the
 * pipeline) is caught and recorded via `markFailed` (Req 9.6); this never
 * rethrows so the surrounding loop keeps running.
 */
export async function processRenderJob(
  job: RenderJob,
  queue: RenderJobQueue,
  store: RenderAssetStore,
  deps: RenderWorkerDeps = {},
  workerId = "render-worker",
): Promise<void> {
  const render = deps.renderProject ?? defaultRenderProject;
  const configPath = deps.configPath ?? CONFIG_RELATIVE_PATH;
  const opts = ownershipFromJob(job, workerId);
  const heartbeatMs = deps.heartbeatIntervalMs ?? 15_000;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  if (heartbeatMs > 0 && queue.heartbeat) {
    heartbeatTimer = setInterval(() => {
      void queue.heartbeat?.(job.id, opts).catch(() => {
        /* late/stolen claim — ignore */
      });
    }, heartbeatMs);
  }
  try {
    const config = await loadProjectConfig(store, job.projectId, configPath);
    const videoFormatOverride = formatOverrideFromParams(job.params);
    const artifacts = await render(config, store, {
      ...(videoFormatOverride !== undefined ? { videoFormatOverride } : {}),
    });
    await queue.markCompleted(job.id, artifacts, opts);
  } catch (err) {
    // Req 9.6: record a descriptive failure message and keep the loop alive.
    try {
      await queue.markFailed(job.id, errorMessage(err), opts);
    } catch {
      /* ownership lost after steal — swallow */
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

/* -------------------------------------------------------------------------- */
/* Run loop                                                                   */
/* -------------------------------------------------------------------------- */

/** Default sleep used between empty polls. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Options controlling {@link runRenderWorker}. */
export interface RunRenderWorkerOptions extends RenderWorkerDeps {
  /** Job types to claim. Defaults to {@link RENDER_JOB_TYPES} (`["render"]`). */
  jobTypes?: string[];
  /** Sleep (ms) between empty polls. Defaults to {@link POLL_INTERVAL_MS}. */
  pollIntervalMs?: number;
  /**
   * Optional predicate ending the loop deterministically. Checked before each
   * claim and again before sleeping on an empty poll. When omitted the loop
   * runs forever (the production process is terminated by a signal).
   */
  stop?: () => boolean;
  /** Sleep function used on empty polls. Defaults to a `setTimeout` delay. */
  sleep?: (ms: number) => Promise<void>;
  /** Stable worker id for claim/fencing. Defaults to a process-based id. */
  workerId?: string;
}

/**
 * Run the claim/process loop until `stop` returns `true` (Req 9.1, 9.6).
 *
 * Mirrors the Audio_Worker loop: while not stopped, claim the oldest pending
 * `render` job; if none is available, (re)check `stop` and sleep before polling
 * again; otherwise process it and record the outcome.
 *
 * ## Wiring note (deliverables task 13.1)
 *
 * `queue` and `store` are injected so the Render_Engine never imports the
 * backend package. The runnable entry point assembled in task 13.1 constructs
 * the concrete dependencies from startup config and passes them in, e.g.:
 *
 * ```ts
 * import { createJobQueue } from "@music-visualizer/backend/queue";
 * import { createAssetStore } from "@music-visualizer/backend/storage";
 * import { loadConfig } from "@music-visualizer/shared/config";
 *
 * const cfg = loadConfig();
 * const queue = createJobQueue(cfg.queue);   // FileJobQueue (structural RenderJobQueue)
 * const store = createAssetStore(cfg.storage); // LocalAssetStore (structural RenderAssetStore)
 * await runRenderWorker(queue, store);        // defaults: render jobs, real renderProject
 * ```
 *
 * Both concrete types satisfy {@link RenderJobQueue} / {@link RenderAssetStore}
 * structurally, so no adapter is required.
 */
export async function runRenderWorker(
  queue: RenderJobQueue,
  store: RenderAssetStore,
  options: RunRenderWorkerOptions = {},
): Promise<void> {
  const types = options.jobTypes ?? [...RENDER_JOB_TYPES];
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sleep = options.sleep ?? delay;
  const stop = options.stop;
  const workerId =
    options.workerId ?? `render-worker:pid:${process.pid}`;
  const deps: RenderWorkerDeps = {
    renderProject: options.renderProject,
    configPath: options.configPath,
    heartbeatIntervalMs: options.heartbeatIntervalMs,
  };

  // Boot recover (orphanOnly or full depending on queue config).
  if (queue.recoverStale) {
    try {
      await queue.recoverStale();
    } catch {
      /* non-fatal */
    }
  }

  while (true) {
    if (stop?.()) return;
    const job = await queue.claimNext(types, { workerId });
    if (job === null) {
      if (stop?.()) return;
      await sleep(pollIntervalMs);
      continue;
    }
    await processRenderJob(job, queue, store, deps, workerId);
  }
}
