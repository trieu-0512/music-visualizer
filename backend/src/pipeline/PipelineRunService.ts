import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { validateLearningMap } from "@music-visualizer/shared";
import type {
  Job,
  JobType,
  PipelineRun,
  PipelineRunStep,
  StartPipelineRequest,
  VideoFormat,
} from "@music-visualizer/shared";
import { candidatePaths } from "../assets/index.js";
import { buildConfig } from "../config/index.js";
import { ApiError, notFound, validationError } from "../http/errors.js";
import type { ProjectRecord, ProjectService } from "../projects/index.js";
import type { JobQueue } from "../queue/JobQueue.js";
import type { AssetStore } from "../storage/index.js";

const PIPELINE_RUN_PATH = "runtime/pipeline-run.json";
const MAPPING_PATH = "authoring/mapping.json";
const VIDEO_FORMATS = new Set<VideoFormat>(["landscape", "portrait", "both"]);

type JobKey = keyof PipelineRun["jobs"];
type BuildConfigFn = typeof buildConfig;

export interface PipelineRunServiceDeps {
  idFactory?: () => string;
  now?: () => string;
  buildConfig?: BuildConfigFn;
}

/**
 * Persistent full-pipeline state machine.
 *
 * Child jobs still use the existing fenced JobQueue. This service only owns
 * dependency ordering and stores one resumable latest run per project. Every
 * child job is tagged with pipelineRunId so a crash between enqueue and state
 * persistence can be recovered without duplicating work.
 */
export class PipelineRunService {
  private readonly advancing = new Set<string>();
  private readonly idFactory: () => string;
  private readonly now: () => string;
  private readonly buildConfigFn: BuildConfigFn;

  constructor(
    private readonly projects: ProjectService,
    private readonly store: AssetStore,
    private readonly queue: JobQueue,
    deps: PipelineRunServiceDeps = {},
  ) {
    this.idFactory = deps.idFactory ?? (() => `run_${randomUUID()}`);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.buildConfigFn = deps.buildConfig ?? buildConfig;
  }

  async start(projectId: string, request: StartPipelineRequest = {}): Promise<PipelineRun> {
    const project = await this.requireProject(projectId);
    const existing = await this.get(projectId);
    if (existing?.status === "running") {
      throw new ApiError(
        "PRECONDITION_FAILED",
        "A full pipeline run is already active for this project",
        { projectId, pipelineRunId: existing.id, step: existing.step },
      );
    }

    const renderFormat = normalizeFormat(request.format, project.videoFormat);
    const now = this.now();
    const hasMapping = await this.store.exists({ projectId, relativePath: MAPPING_PATH });
    if (hasMapping) await this.assertLockedMapping(projectId);
    const run: PipelineRun = {
      id: this.idFactory(),
      projectId,
      status: "running",
      step: hasMapping ? "prepare-assets" : "transcribe-analyze",
      renderFormat,
      jobs: {},
      createdAt: now,
      updatedAt: now,
    };
    await this.write(run);
    return (await this.advance(projectId)) ?? run;
  }

  async get(projectId: string): Promise<PipelineRun | null> {
    if ((await this.projects.get(projectId)) === null) {
      throw notFound(`Project not found: ${projectId}`, { projectId });
    }
    return this.read(projectId);
  }

  /** Advance at most to the next asynchronous wait point. Safe to call repeatedly. */
  async advance(projectId: string): Promise<PipelineRun | null> {
    if (this.advancing.has(projectId)) return this.read(projectId);
    this.advancing.add(projectId);
    try {
      let run = await this.read(projectId);
      if (!run || run.status !== "running") return run;
      const project = await this.requireProject(projectId);

      switch (run.step) {
        case "prepare-assets":
          run = await this.advancePrepare(run);
          break;
        case "transcribe-analyze":
          run = await this.advanceAudio(run);
          break;
        case "build-config":
          run = await this.advanceBuildConfig(run, project);
          break;
        case "render":
          run = await this.advanceRender(run);
          break;
        case "completed":
        case "failed":
          return run;
      }
      return run;
    } finally {
      this.advancing.delete(projectId);
    }
  }

  /** Resume every active project run; intended for the API-process supervisor tick. */
  async advanceAll(): Promise<void> {
    for (const projectId of await this.store.listProjects()) {
      try {
        const run = await this.read(projectId);
        if (run?.status === "running") await this.advance(projectId);
      } catch {
        // One corrupt/project-specific run must not stop supervision for others.
      }
    }
  }

  private async advancePrepare(run: PipelineRun): Promise<PipelineRun> {
    const { run: updated, job } = await this.ensureJob(run, "prepareAssets", "prepare-assets");
    if (job.status === "failed") return this.fail(updated, job.error ?? "prepare-assets job failed");
    if (job.status !== "completed") return updated;
    return this.move(updated, "transcribe-analyze");
  }

  private async advanceAudio(run: PipelineRun): Promise<PipelineRun> {
    if (!(await this.hasAudio(run.projectId))) {
      return this.fail(run, "An Audio_Asset is required before transcription and analysis");
    }

    let current = run;
    const transcribeResult = await this.ensureJob(current, "transcribe", "transcribe");
    current = transcribeResult.run;
    const analyzeResult = await this.ensureJob(current, "analyze", "analyze");
    current = analyzeResult.run;

    if (transcribeResult.job.status === "failed") {
      return this.fail(current, transcribeResult.job.error ?? "transcribe job failed");
    }
    if (analyzeResult.job.status === "failed") {
      return this.fail(current, analyzeResult.job.error ?? "analyze job failed");
    }
    if (
      transcribeResult.job.status === "completed" &&
      analyzeResult.job.status === "completed"
    ) {
      return this.move(current, "build-config");
    }
    return current;
  }

  private async advanceBuildConfig(run: PipelineRun, project: ProjectRecord): Promise<PipelineRun> {
    const result = await this.buildConfigFn(run.projectId, this.store, project);
    if (!result.ok) {
      return this.fail(run, `${result.error.code}: ${result.error.message}`);
    }
    return this.move(run, "render");
  }

  private async advanceRender(run: PipelineRun): Promise<PipelineRun> {
    const result = await this.ensureJob(run, "render", "render", { format: run.renderFormat });
    if (result.job.status === "failed") {
      return this.fail(result.run, result.job.error ?? "render job failed");
    }
    if (result.job.status === "completed") {
      return this.finish(result.run);
    }
    return result.run;
  }

  private async ensureJob(
    run: PipelineRun,
    key: JobKey,
    type: JobType,
    params: Record<string, unknown> = {},
  ): Promise<{ run: PipelineRun; job: Job }> {
    let job: Job | null = null;
    const existingId = run.jobs[key];
    if (existingId) job = await this.queue.get(existingId);

    if (!job) {
      const existing = (await this.queue.listByProject(run.projectId)).find(
        (candidate) =>
          candidate.type === type &&
          candidate.params?.pipelineRunId === run.id,
      );
      job = existing ?? await this.queue.enqueue({
        projectId: run.projectId,
        type,
        params: {
          ...params,
          pipelineRunId: run.id,
          pipelineStep: run.step,
        },
      });
    }

    if (run.jobs[key] !== job.id) {
      run = {
        ...run,
        jobs: { ...run.jobs, [key]: job.id },
        updatedAt: this.now(),
      };
      await this.write(run);
    }
    return { run, job };
  }

  private async move(run: PipelineRun, step: PipelineRunStep): Promise<PipelineRun> {
    const next: PipelineRun = { ...run, step, updatedAt: this.now() };
    await this.write(next);
    return next;
  }

  private async fail(run: PipelineRun, error: string): Promise<PipelineRun> {
    const next: PipelineRun = {
      ...run,
      status: "failed",
      step: "failed",
      error,
      updatedAt: this.now(),
    };
    await this.write(next);
    return next;
  }

  private async finish(run: PipelineRun): Promise<PipelineRun> {
    const next: PipelineRun = {
      ...run,
      status: "completed",
      step: "completed",
      updatedAt: this.now(),
    };
    delete next.error;
    await this.write(next);
    return next;
  }

  private async assertLockedMapping(projectId: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        (await this.store.read({ projectId, relativePath: MAPPING_PATH })).toString("utf-8"),
      );
    } catch {
      throw new ApiError(
        "PRECONDITION_FAILED",
        "authoring/mapping.json must be valid JSON before starting the full pipeline",
        { projectId },
      );
    }
    const validation = validateLearningMap(parsed);
    if (!validation.ok) {
      throw new ApiError(
        "PRECONDITION_FAILED",
        "authoring/mapping.json must be LOCKED and schema-valid before starting the full pipeline",
        { projectId, errors: validation.error },
      );
    }
  }

  private async hasAudio(projectId: string): Promise<boolean> {
    for (const relativePath of candidatePaths("audio")) {
      if (await this.store.exists({ projectId, relativePath })) return true;
    }
    return false;
  }

  private async requireProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.get(projectId);
    if (!project) throw notFound(`Project not found: ${projectId}`, { projectId });
    return project;
  }

  private async read(projectId: string): Promise<PipelineRun | null> {
    const ref = { projectId, relativePath: PIPELINE_RUN_PATH };
    if (!(await this.store.exists(ref))) return null;
    return JSON.parse((await this.store.read(ref)).toString("utf-8")) as PipelineRun;
  }

  private async write(run: PipelineRun): Promise<void> {
    await this.store.write(
      { projectId: run.projectId, relativePath: PIPELINE_RUN_PATH },
      Buffer.from(JSON.stringify(run, null, 2), "utf-8"),
    );
  }
}

function normalizeFormat(value: VideoFormat | undefined, fallback: VideoFormat): VideoFormat {
  if (value === undefined) return fallback;
  if (!VIDEO_FORMATS.has(value)) {
    throw validationError("Pipeline format must be one of: landscape, portrait, both", { format: value });
  }
  return value;
}

export function startPipelineSupervisor(
  service: PipelineRunService,
  intervalMs = 1000,
): ReturnType<typeof setInterval> {
  let ticking = false;
  const tick = async (): Promise<void> => {
    if (ticking) return;
    ticking = true;
    try {
      await service.advanceAll();
    } catch {
      // Storage/queue outages are retried on the next supervisor tick.
    } finally {
      ticking = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  return timer;
}
