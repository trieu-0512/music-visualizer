import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Job, JobStatus } from "@music-visualizer/shared";
import { ProjectService } from "../projects/index.js";
import type {
  ClaimOptions,
  JobQueue,
  OwnershipOpts,
} from "../queue/JobQueue.js";
import { LocalAssetStore, type AssetStore } from "../storage/index.js";
import { PipelineRunService } from "./PipelineRunService.js";

class FakeQueue implements JobQueue {
  readonly jobs = new Map<string, Job>();
  enqueueCount = 0;

  async enqueue(input: Pick<Job, "projectId" | "type" | "params">): Promise<Job> {
    this.enqueueCount += 1;
    const now = "2026-08-08T00:00:00.000Z";
    const job: Job = {
      id: `job-${this.enqueueCount}`,
      projectId: input.projectId,
      type: input.type,
      status: "pending",
      params: input.params,
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async get(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listByProject(projectId: string): Promise<Job[]> {
    return [...this.jobs.values()].filter((job) => job.projectId === projectId);
  }

  async claimNext(_types: Job["type"][], _opts: ClaimOptions): Promise<Job | null> {
    return null;
  }

  async heartbeat(jobId: string, _opts: OwnershipOpts): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("missing fake job");
    return job;
  }

  async markCompleted(jobId: string, artifacts: string[], _opts: OwnershipOpts): Promise<Job> {
    return this.setStatus(jobId, "completed", { artifacts });
  }

  async markFailed(jobId: string, error: string, _opts: OwnershipOpts): Promise<Job> {
    return this.setStatus(jobId, "failed", { error });
  }

  async recoverStale(): Promise<Job[]> {
    return [];
  }

  async markRunning(jobId: string): Promise<Job> {
    return this.setStatus(jobId, "running");
  }

  setStatus(
    jobId: string,
    status: JobStatus,
    patch: Partial<Job> = {},
  ): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`missing fake job ${jobId}`);
    const next: Job = {
      ...job,
      ...patch,
      status,
      updatedAt: "2026-08-08T00:00:01.000Z",
    };
    this.jobs.set(jobId, next);
    return next;
  }
}

describe("PipelineRunService", () => {
  let root: string;
  let store: AssetStore;
  let projects: ProjectService;
  let queue: FakeQueue;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-pipeline-"));
    store = new LocalAssetStore(root);
    projects = new ProjectService(store, () => "p1");
    await projects.create({ songName: "ABC", singerName: "Kids", videoFormat: "both" });
    await store.write({ projectId: "p1", relativePath: "assets/audio.mp3" }, Buffer.from("audio"));
    queue = new FakeQueue();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("persists and resumes a full legacy run without duplicate child jobs", async () => {
    const deps = {
      idFactory: () => "run-1",
      now: () => "2026-08-08T00:00:00.000Z",
      buildConfig: async () => ({ ok: true, value: {} as never } as const),
    };
    const firstService = new PipelineRunService(projects, store, queue, deps);
    const started = await firstService.start("p1", { format: "portrait" });

    expect(started.status).toBe("running");
    expect(started.step).toBe("transcribe-analyze");
    expect(started.renderFormat).toBe("portrait");
    expect(queue.enqueueCount).toBe(2);
    expect(started.jobs.transcribe).toBeTruthy();
    expect(started.jobs.analyze).toBeTruthy();

    // Simulate an API restart while the same queue/store survive. The resumed
    // service must recover tagged child jobs rather than enqueue duplicates.
    const resumedService = new PipelineRunService(projects, store, queue, deps);
    await resumedService.advance("p1");
    expect(queue.enqueueCount).toBe(2);

    queue.setStatus(started.jobs.transcribe!, "completed");
    queue.setStatus(started.jobs.analyze!, "completed");
    expect((await resumedService.advance("p1"))?.step).toBe("build-config");
    expect((await resumedService.advance("p1"))?.step).toBe("render");

    const waitingRender = await resumedService.advance("p1");
    expect(waitingRender?.jobs.render).toBeTruthy();
    expect(queue.enqueueCount).toBe(3);
    queue.setStatus(waitingRender!.jobs.render!, "completed");

    const completed = await resumedService.advance("p1");
    expect(completed?.status).toBe("completed");
    expect(completed?.step).toBe("completed");

    const persisted = JSON.parse(
      (await store.read({ projectId: "p1", relativePath: "runtime/pipeline-run.json" })).toString("utf-8"),
    );
    expect(persisted.id).toBe("run-1");
    expect(persisted.status).toBe("completed");
  });

  it("starts theme-first runs with prepare-assets and blocks a second active run", async () => {
    await store.write(
      { projectId: "p1", relativePath: "authoring/mapping.json" },
      Buffer.from(JSON.stringify({
        version: 1,
        revision: 1,
        state: "LOCKED",
        theme: {
          name: "Test Theme",
          scope: "guided",
          mappingAuthority: "project-locked",
          ageBand: "mixed-2-6",
          mode: "LETTER_NAME",
        },
        letters: Object.fromEntries(
          [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => [letter, { object: `Object ${letter}` }]),
        ),
      })),
    );
    const service = new PipelineRunService(projects, store, queue, {
      idFactory: () => "run-theme",
      buildConfig: async () => ({ ok: true, value: {} as never } as const),
    });

    const run = await service.start("p1");
    expect(run.step).toBe("prepare-assets");
    expect(run.jobs.prepareAssets).toBeTruthy();
    expect(queue.enqueueCount).toBe(1);

    await expect(service.start("p1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("marks a run failed when a child job fails", async () => {
    const service = new PipelineRunService(projects, store, queue, {
      idFactory: () => "run-fail",
      buildConfig: async () => ({ ok: true, value: {} as never } as const),
    });
    const run = await service.start("p1");
    queue.setStatus(run.jobs.transcribe!, "failed", { error: "ASR mismatch" });

    const failed = await service.advance("p1");
    expect(failed?.status).toBe("failed");
    expect(failed?.step).toBe("failed");
    expect(failed?.error).toContain("ASR mismatch");
  });
});
