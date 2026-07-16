import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { workspaceRoot } from "@music-visualizer/shared/config";
import type { QueueConfig } from "@music-visualizer/shared/config";

/**
 * Job_Queue (`backend`).
 *
 * Accepts and tracks transcription/analysis/render jobs and accepts many at
 * once for batch/bulk rendering (Req 12, 15.3). The MVP {@link FileJobQueue}
 * stores each job as a JSON file under `storage/jobs/` and is polled by
 * workers; the interface maps cleanly onto BullMQ/Redis later without
 * touching callers.
 */

export type JobType = "transcribe" | "analyze" | "render";
export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  /** e.g. `{ format: "both" }` for a render job. */
  params: Record<string, unknown>;
  /** relativePaths produced (recorded on completion). */
  artifacts: string[];
  /** failure message (recorded on failure). */
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobQueue {
  /** Accept a new job; it starts in the `pending` state (Req 12.1). */
  enqueue(job: Pick<Job, "projectId" | "type" | "params">): Promise<Job>;
  /** Return a job by id, or `null` when it does not exist (Req 12.2). */
  get(jobId: string): Promise<Job | null>;
  /** Return every job for a project, ordered oldest-first. */
  listByProject(projectId: string): Promise<Job[]>;
  /** Atomically pull the oldest `pending` job whose type is in `types` (Req 12.2). */
  claimNext(types: JobType[]): Promise<Job | null>;
  markRunning(jobId: string): Promise<Job>;
  /** Record completion plus the artifacts the job produced (Req 12.3). */
  markCompleted(jobId: string, artifacts: string[]): Promise<Job>;
  /** Record failure and retain the error message (Req 12.4). */
  markFailed(jobId: string, error: string): Promise<Job>;
}

/**
 * File-based Job_Queue. Each job is one JSON file `{jobId}.json` under `dir`.
 *
 * Hybrid claim protocol (Architecture Upgrade KD-1 / PR-02):
 * the `pending → running` transition is atomic under a per-job O_EXCL lock
 * file (`{jobId}.lock`). The lock is **held until** `markCompleted` /
 * `markFailed` so other workers cannot reclaim an in-flight job. Claim write
 * failures always release the lock before continuing.
 *
 * Release train: do not run production Python workers against this protocol
 * until the matching Python claim changes (PR-03) are also deployed.
 */
export class FileJobQueue implements JobQueue {
  private readonly dir: string;

  /**
   * @param dir Directory holding job records. Relative paths are resolved
   * against the workspace root so the queue location stays portable.
   */
  constructor(dir: string) {
    this.dir = isAbsolute(dir) ? dir : resolve(workspaceRoot(), dir);
  }

  async enqueue(input: Pick<Job, "projectId" | "type" | "params">): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      projectId: input.projectId,
      type: input.type,
      status: "pending",
      params: input.params,
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.writeJob(job);
    return job;
  }

  async get(jobId: string): Promise<Job | null> {
    try {
      const raw = await readFile(this.jobPath(jobId), "utf-8");
      return JSON.parse(raw) as Job;
    } catch (err) {
      if (isErrno(err, "ENOENT")) return null;
      throw err;
    }
  }

  async listByProject(projectId: string): Promise<Job[]> {
    const jobs = await this.readAll();
    return jobs.filter((job) => job.projectId === projectId).sort(byCreatedThenId);
  }

  async claimNext(types: JobType[]): Promise<Job | null> {
    const allowed = new Set(types);
    const candidates = (await this.readAll())
      .filter((job) => job.status === "pending" && allowed.has(job.type))
      .sort(byCreatedThenId);

    for (const candidate of candidates) {
      if (!(await this.tryLock(candidate.id))) {
        // Another worker owns this job; try the next candidate.
        continue;
      }
      try {
        const fresh = await this.get(candidate.id);
        if (fresh === null || fresh.status !== "pending") {
          await this.releaseLock(candidate.id);
          continue;
        }
        const claimed: Job = {
          ...fresh,
          status: "running",
          updatedAt: new Date().toISOString(),
        };
        await this.writeJob(claimed);
        // Hold the lock until markCompleted / markFailed.
        return claimed;
      } catch (err) {
        // Never leave an orphan lock after a failed claim write.
        await this.releaseLock(candidate.id);
        throw err;
      }
    }
    return null;
  }

  markRunning(jobId: string): Promise<Job> {
    return this.update(jobId, (job) =>
      job.status === "running" ? job : { ...job, status: "running" },
    );
  }

  async markCompleted(jobId: string, artifacts: string[]): Promise<Job> {
    const next = await this.update(jobId, (job) => ({
      ...job,
      status: "completed",
      artifacts,
    }));
    await this.releaseLock(jobId);
    return next;
  }

  async markFailed(jobId: string, error: string): Promise<Job> {
    const next = await this.update(jobId, (job) => ({
      ...job,
      status: "failed",
      error,
    }));
    await this.releaseLock(jobId);
    return next;
  }

  // --- internals -----------------------------------------------------------

  private jobPath(jobId: string): string {
    return join(this.dir, `${jobId}.json`);
  }

  private lockPath(jobId: string): string {
    return join(this.dir, `${jobId}.lock`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  /** Write a job record atomically (write temp file, then rename into place). */
  private async writeJob(job: Job): Promise<void> {
    await this.ensureDir();
    const tmp = join(this.dir, `${job.id}.${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(job, null, 2), "utf-8");
    await rename(tmp, this.jobPath(job.id));
  }

  /** Read and parse every `{jobId}.json` record in the queue directory. */
  private async readAll(): Promise<Job[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if (isErrno(err, "ENOENT")) return [];
      throw err;
    }
    const jobs: Job[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.dir, name), "utf-8");
        jobs.push(JSON.parse(raw) as Job);
      } catch (err) {
        // A job removed between listing and reading is simply skipped.
        if (isErrno(err, "ENOENT")) continue;
        throw err;
      }
    }
    return jobs;
  }

  /** Acquire the per-job claim lock via an O_EXCL create; `false` if held. */
  private async tryLock(jobId: string): Promise<boolean> {
    await this.ensureDir();
    try {
      const handle = await open(this.lockPath(jobId), "wx");
      await handle.close();
      return true;
    } catch (err) {
      if (isErrno(err, "EEXIST")) return false;
      throw err;
    }
  }

  private async releaseLock(jobId: string): Promise<void> {
    await rm(this.lockPath(jobId), { force: true });
  }

  private async update(jobId: string, mutate: (job: Job) => Job): Promise<Job> {
    const current = await this.get(jobId);
    if (current === null) throw new Error(`Job not found: ${jobId}`);
    const mutated = mutate(current);
    // Avoid a no-op rewrite when markRunning is called on an already-running job.
    if (mutated === current) return current;
    const next: Job = { ...mutated, updatedAt: new Date().toISOString() };
    await this.writeJob(next);
    return next;
  }
}

/** Order jobs oldest-first; the id breaks ties deterministically. */
function byCreatedThenId(a: Job, b: Job): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function isErrno(err: unknown, code: string): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === code;
}

/**
 * Select the Job_Queue backend from configuration at startup. Additional
 * backends (e.g. BullMQ/Redis) can be added without changing callers.
 */
export function createJobQueue(config: QueueConfig): JobQueue {
  switch (config.backend) {
    case "file":
      return new FileJobQueue(config.dir);
    default:
      throw new Error(`Unknown queue backend: ${(config as QueueConfig).backend}`);
  }
}
