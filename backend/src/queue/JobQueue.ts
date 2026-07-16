import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { workspaceRoot } from "@music-visualizer/shared/config";
import type { QueueConfig } from "@music-visualizer/shared/config";
import { QUEUE_CONFIG_DEFAULTS } from "@music-visualizer/shared/config";
import type { Job, JobStatus, JobType } from "@music-visualizer/shared";

/**
 * Job_Queue (`backend`).
 *
 * Hybrid claim + ownership fencing + staged stale recovery
 * (Architecture Upgrade KD-1..KD-22 / PR-02..PR-04c).
 *
 * Transport types (`Job`, `JobType`, `JobStatus`) are shared with the frontend
 * via `@music-visualizer/shared` (PR-08).
 */

export type { Job, JobStatus, JobType };

export interface ClaimOptions {
  workerId: string;
}

export interface OwnershipOpts {
  workerId: string;
  claimGeneration: number;
}

export class OwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipError";
  }
}

export interface NormalizedQueueConfig {
  backend: QueueConfig["backend"];
  dir: string;
  leaseMs: number;
  heartbeatIntervalMs: number;
  maxRequeuesAudio: number;
  maxRequeuesRender: number;
  leaseRecoveryEnabled: boolean;
}

export interface JobQueue {
  enqueue(job: Pick<Job, "projectId" | "type" | "params">): Promise<Job>;
  get(jobId: string): Promise<Job | null>;
  listByProject(projectId: string): Promise<Job[]>;
  claimNext(types: JobType[], opts: ClaimOptions): Promise<Job | null>;
  heartbeat(jobId: string, opts: OwnershipOpts): Promise<Job>;
  markCompleted(jobId: string, artifacts: string[], opts: OwnershipOpts): Promise<Job>;
  markFailed(jobId: string, error: string, opts: OwnershipOpts): Promise<Job>;
  recoverStale(opts?: { now?: Date }): Promise<Job[]>;
  /** @deprecated Prefer claimNext; no-op rewrite when already running. */
  markRunning(jobId: string): Promise<Job>;
}

/** Build a stable worker id for this process (used by workers). */
export function defaultWorkerId(role: string): string {
  return `${role}:${hostname()}:pid:${process.pid}`;
}

export function normalizeQueueConfig(
  input: string | QueueConfig | NormalizedQueueConfig,
): NormalizedQueueConfig {
  if (typeof input === "string") {
    return {
      backend: "file",
      dir: input,
      ...QUEUE_CONFIG_DEFAULTS,
    };
  }
  return {
    backend: input.backend,
    dir: input.dir,
    leaseMs: input.leaseMs ?? QUEUE_CONFIG_DEFAULTS.leaseMs,
    heartbeatIntervalMs:
      input.heartbeatIntervalMs ?? QUEUE_CONFIG_DEFAULTS.heartbeatIntervalMs,
    maxRequeuesAudio:
      input.maxRequeuesAudio ?? QUEUE_CONFIG_DEFAULTS.maxRequeuesAudio,
    maxRequeuesRender:
      input.maxRequeuesRender ?? QUEUE_CONFIG_DEFAULTS.maxRequeuesRender,
    leaseRecoveryEnabled:
      input.leaseRecoveryEnabled ?? QUEUE_CONFIG_DEFAULTS.leaseRecoveryEnabled,
  };
}

function clearClaimFields(job: Job): Job {
  const next = { ...job };
  delete next.claimedAt;
  delete next.heartbeatAt;
  delete next.claimedBy;
  // keep claimGeneration / requeueCount
  return next;
}

function ownershipMatches(job: Job, opts: OwnershipOpts): boolean {
  return (
    job.status === "running" &&
    job.claimedBy === opts.workerId &&
    (job.claimGeneration ?? 0) === opts.claimGeneration
  );
}

function parseIsoMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * File-based Job_Queue. Each job is one JSON file `{jobId}.json` under `dir`.
 */
export class FileJobQueue implements JobQueue {
  private readonly dir: string;
  readonly config: NormalizedQueueConfig;

  /**
   * @param dirOrConfig Directory path (tests) or full {@link QueueConfig}.
   * Defaults for lease fields always applied (KD-16).
   */
  constructor(dirOrConfig: string | QueueConfig | NormalizedQueueConfig) {
    this.config = normalizeQueueConfig(dirOrConfig);
    this.dir = isAbsolute(this.config.dir)
      ? this.config.dir
      : resolve(workspaceRoot(), this.config.dir);
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

  async claimNext(types: JobType[], opts: ClaimOptions): Promise<Job | null> {
    if (!opts?.workerId) {
      throw new Error("claimNext requires opts.workerId");
    }
    // Opportunistic recover before claim (orphanOnly unless leaseRecoveryEnabled).
    await this.recoverStale();

    const allowed = new Set(types);
    const candidates = (await this.readAll())
      .filter((job) => job.status === "pending" && allowed.has(job.type))
      .sort(byCreatedThenId);

    for (const candidate of candidates) {
      if (!(await this.tryLock(candidate.id))) continue;
      try {
        const fresh = await this.get(candidate.id);
        if (fresh === null || fresh.status !== "pending") {
          await this.releaseLock(candidate.id);
          continue;
        }
        const now = new Date().toISOString();
        const claimed: Job = {
          ...fresh,
          status: "running",
          claimedAt: now,
          heartbeatAt: now,
          claimedBy: opts.workerId,
          claimGeneration: fresh.claimGeneration ?? 0,
          updatedAt: now,
        };
        await this.writeJob(claimed);
        return claimed;
      } catch (err) {
        await this.releaseLock(candidate.id);
        throw err;
      }
    }
    return null;
  }

  async heartbeat(jobId: string, opts: OwnershipOpts): Promise<Job> {
    const current = await this.require(jobId);
    if (!ownershipMatches(current, opts)) {
      throw new OwnershipError(
        `heartbeat ownership mismatch for job ${jobId} (status=${current.status}, claimedBy=${current.claimedBy}, gen=${current.claimGeneration})`,
      );
    }
    const next: Job = {
      ...current,
      heartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.writeJob(next);
    return next;
  }

  markRunning(jobId: string): Promise<Job> {
    return this.update(jobId, (job) =>
      job.status === "running" ? job : { ...job, status: "running" },
    );
  }

  async markCompleted(
    jobId: string,
    artifacts: string[],
    opts: OwnershipOpts,
  ): Promise<Job> {
    const current = await this.require(jobId);
    if (!ownershipMatches(current, opts)) {
      throw new OwnershipError(
        `markCompleted ownership mismatch for job ${jobId}`,
      );
    }
    const cleared = clearClaimFields(current);
    const next: Job = {
      ...cleared,
      status: "completed",
      artifacts,
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    delete next.error;
    await this.writeJob(next);
    await this.releaseLock(jobId);
    return next;
  }

  async markFailed(
    jobId: string,
    error: string,
    opts: OwnershipOpts,
  ): Promise<Job> {
    const current = await this.require(jobId);
    if (!ownershipMatches(current, opts)) {
      throw new OwnershipError(`markFailed ownership mismatch for job ${jobId}`);
    }
    const cleared = clearClaimFields(current);
    const next: Job = {
      ...cleared,
      status: "failed",
      error,
      updatedAt: new Date().toISOString(),
    };
    await this.writeJob(next);
    await this.releaseLock(jobId);
    return next;
  }

  async recoverStale(opts?: { now?: Date }): Promise<Job[]> {
    const now = opts?.now ?? new Date();
    const nowMs = now.getTime();
    const mode = this.config.leaseRecoveryEnabled ? "full" : "orphanOnly";
    const affected: Job[] = [];

    const ids = await this.allJobIdsAndLockStems();
    for (const jobId of ids) {
      let job = await this.get(jobId);
      const lockPresent = await this.lockExists(jobId);

      if (lockPresent && (await this.mayBreakLock(mode, job, jobId, nowMs))) {
        await this.releaseLock(jobId);
      }

      if (!(await this.tryLock(jobId))) {
        continue;
      }

      try {
        const fresh = await this.get(jobId);

        if (mode === "orphanOnly") {
          // Clean locks only; never KD-4 running jobs.
          await this.releaseLock(jobId);
          if (fresh === null || fresh.status !== "running") {
            // Pending/terminal/missing healed by unlocking.
            if (fresh) affected.push(fresh);
          }
          continue;
        }

        // full mode
        if (fresh === null) {
          await this.releaseLock(jobId);
          continue;
        }
        if (fresh.status === "completed" || fresh.status === "failed") {
          await this.releaseLock(jobId);
          affected.push(fresh);
          continue;
        }
        if (fresh.status === "pending") {
          await this.releaseLock(jobId);
          affected.push(fresh);
          continue;
        }

        // running
        if (!this.leaseExpired(fresh, nowMs)) {
          await this.releaseLock(jobId);
          continue;
        }

        const maxRq = this.maxRequeuesFor(fresh.type);
        const requeues = fresh.requeueCount ?? 0;
        if (requeues >= maxRq) {
          const failed = clearClaimFields(fresh);
          const next: Job = {
            ...failed,
            status: "failed",
            error: "stale lease expired",
            updatedAt: now.toISOString(),
          };
          await this.writeJob(next);
          await this.releaseLock(jobId);
          affected.push(next);
        } else {
          const requeued = clearClaimFields(fresh);
          const next: Job = {
            ...requeued,
            status: "pending",
            requeueCount: requeues + 1,
            claimGeneration: (fresh.claimGeneration ?? 0) + 1,
            updatedAt: now.toISOString(),
          };
          delete next.error;
          await this.writeJob(next);
          await this.releaseLock(jobId);
          affected.push(next);
        }
      } catch {
        await this.releaseLock(jobId);
      }
    }
    return affected;
  }

  // --- internals -----------------------------------------------------------

  private maxRequeuesFor(type: JobType): number {
    return type === "render"
      ? this.config.maxRequeuesRender
      : this.config.maxRequeuesAudio;
  }

  private leaseExpired(job: Job, nowMs: number): boolean {
    const anchor =
      parseIsoMs(job.heartbeatAt) ??
      parseIsoMs(job.claimedAt) ??
      parseIsoMs(job.updatedAt) ??
      0;
    return nowMs - anchor > this.config.leaseMs;
  }

  private async mayBreakLock(
    mode: "orphanOnly" | "full",
    job: Job | null,
    jobId: string,
    nowMs: number,
  ): Promise<boolean> {
    if (job === null) return true;
    if (job.status === "completed" || job.status === "failed") {
      return this.lockExists(jobId);
    }
    if (job.status === "pending") {
      if (!(await this.lockExists(jobId))) return false;
      const age = await this.lockAgeMs(jobId, nowMs);
      return age > this.config.leaseMs;
    }
    if (job.status === "running") {
      if (mode === "orphanOnly") return false;
      return this.leaseExpired(job, nowMs);
    }
    return false;
  }

  private async lockAgeMs(jobId: string, nowMs: number): Promise<number> {
    try {
      const s = await stat(this.lockPath(jobId));
      return nowMs - s.mtimeMs;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  private async lockExists(jobId: string): Promise<boolean> {
    try {
      await stat(this.lockPath(jobId));
      return true;
    } catch {
      return false;
    }
  }

  private async allJobIdsAndLockStems(): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if (isErrno(err, "ENOENT")) return [];
      throw err;
    }
    const ids = new Set<string>();
    for (const name of names) {
      if (name.endsWith(".json")) ids.add(name.slice(0, -".json".length));
      else if (name.endsWith(".lock")) ids.add(name.slice(0, -".lock".length));
    }
    return [...ids];
  }

  private jobPath(jobId: string): string {
    return join(this.dir, `${jobId}.json`);
  }

  private lockPath(jobId: string): string {
    return join(this.dir, `${jobId}.lock`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private async writeJob(job: Job): Promise<void> {
    await this.ensureDir();
    const tmp = join(this.dir, `${job.id}.${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(job, null, 2), "utf-8");
    await rename(tmp, this.jobPath(job.id));
  }

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
        if (isErrno(err, "ENOENT")) continue;
        throw err;
      }
    }
    return jobs;
  }

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

  private async require(jobId: string): Promise<Job> {
    const job = await this.get(jobId);
    if (job === null) throw new Error(`Job not found: ${jobId}`);
    return job;
  }

  private async update(jobId: string, mutate: (job: Job) => Job): Promise<Job> {
    const current = await this.require(jobId);
    const mutated = mutate(current);
    if (mutated === current) return current;
    const next: Job = { ...mutated, updatedAt: new Date().toISOString() };
    await this.writeJob(next);
    return next;
  }

  /** Test helper: force a lock file mtime into the past. */
  async touchLockAge(jobId: string, ageMs: number): Promise<void> {
    const path = this.lockPath(jobId);
    const past = new Date(Date.now() - ageMs);
    await utimes(path, past, past);
  }
}

function byCreatedThenId(a: Job, b: Job): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function isErrno(err: unknown, code: string): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === code;
}

export function createJobQueue(config: QueueConfig): JobQueue {
  switch (config.backend) {
    case "file":
      return new FileJobQueue(config);
    default:
      throw new Error(`Unknown queue backend: ${(config as QueueConfig).backend}`);
  }
}
