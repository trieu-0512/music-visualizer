import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FileJobQueue,
  OwnershipError,
  createJobQueue,
  type JobQueue,
  type OwnershipOpts,
} from "./JobQueue.js";

const WORKER_A = { workerId: "test-worker-a" };
const WORKER_B = { workerId: "test-worker-b" };

function own(job: { claimGeneration?: number; claimedBy?: string }): OwnershipOpts {
  return {
    workerId: job.claimedBy ?? WORKER_A.workerId,
    claimGeneration: job.claimGeneration ?? 0,
  };
}

async function lockExists(dir: string, jobId: string): Promise<boolean> {
  try {
    await access(join(dir, `${jobId}.lock`), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe("FileJobQueue", () => {
  let dir: string;
  let queue: FileJobQueue;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mv-jobs-"));
    queue = new FileJobQueue({
      backend: "file",
      dir,
      leaseMs: 120_000,
      heartbeatIntervalMs: 15_000,
      maxRequeuesAudio: 1,
      maxRequeuesRender: 0,
      leaseRecoveryEnabled: false,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("enqueues a job in the pending state (Req 12.1)", async () => {
    const job = await queue.enqueue({
      projectId: "p1",
      type: "transcribe",
      params: {},
    });
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("pending");
    expect(job.artifacts).toEqual([]);
    expect(await queue.get(job.id)).toEqual(job);
  });

  it("returns null for an unknown job id (Req 12.2)", async () => {
    expect(await queue.get("does-not-exist")).toBeNull();
  });

  it("lists jobs for a project oldest-first", async () => {
    const a = await queue.enqueue({ projectId: "p1", type: "transcribe", params: {} });
    const b = await queue.enqueue({ projectId: "p1", type: "analyze", params: {} });
    await queue.enqueue({ projectId: "p2", type: "render", params: {} });
    const listed = await queue.listByProject("p1");
    expect(listed.map((j) => j.id)).toEqual([a.id, b.id]);
  });

  it("claims only pending jobs matching the requested types (Req 12.2)", async () => {
    const transcribe = await queue.enqueue({ projectId: "p1", type: "transcribe", params: {} });
    await queue.enqueue({ projectId: "p1", type: "render", params: {} });

    const claimed = await queue.claimNext(["transcribe", "analyze"], WORKER_A);
    expect(claimed?.id).toBe(transcribe.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.claimedBy).toBe(WORKER_A.workerId);
    expect(claimed?.claimGeneration).toBe(0);
    expect(await lockExists(dir, transcribe.id)).toBe(true);

    expect(await queue.claimNext(["transcribe", "analyze"], WORKER_B)).toBeNull();
  });

  it("never lets two claims take the same job", async () => {
    await queue.enqueue({ projectId: "p1", type: "render", params: {} });
    const [first, second] = await Promise.all([
      queue.claimNext(["render"], WORKER_A),
      queue.claimNext(["render"], WORKER_B),
    ]);
    const claimed = [first, second].filter((j) => j !== null);
    expect(claimed).toHaveLength(1);
  });

  it("records produced artifacts on completion and releases the lock (Req 12.3)", async () => {
    const job = await queue.enqueue({ projectId: "p1", type: "render", params: {} });
    const claimed = await queue.claimNext(["render"], WORKER_A);
    expect(claimed?.id).toBe(job.id);
    expect(await lockExists(dir, job.id)).toBe(true);
    const done = await queue.markCompleted(
      job.id,
      [
        "artifacts/final-16x9-fullhd-60fps.mp4",
        "artifacts/final-9x16-fullhd-60fps.mp4",
      ],
      own(claimed!),
    );
    expect(done.status).toBe("completed");
    expect(done.artifacts).toEqual([
      "artifacts/final-16x9-fullhd-60fps.mp4",
      "artifacts/final-9x16-fullhd-60fps.mp4",
    ]);
    expect(await lockExists(dir, job.id)).toBe(false);
  });

  it("retains the error message on failure and releases the lock (Req 12.4)", async () => {
    const job = await queue.enqueue({ projectId: "p1", type: "analyze", params: {} });
    const claimed = await queue.claimNext(["analyze"], WORKER_A);
    expect(await lockExists(dir, job.id)).toBe(true);
    const failed = await queue.markFailed(job.id, "decode error", own(claimed!));
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("decode error");
    expect(await lockExists(dir, job.id)).toBe(false);
  });

  it("rejects terminal transitions without ownership fencing", async () => {
    const job = await queue.enqueue({ projectId: "p1", type: "render", params: {} });
    await queue.claimNext(["render"], WORKER_A);
    await expect(
      queue.markCompleted(job.id, [], { workerId: WORKER_B.workerId, claimGeneration: 0 }),
    ).rejects.toBeInstanceOf(OwnershipError);
  });

  it("recoverStale orphanOnly removes stale pending locks without touching running", async () => {
    const pending = await queue.enqueue({ projectId: "p1", type: "transcribe", params: {} });
    // Simulate orphan lock on pending (legacy crash).
    await writeFile(join(dir, `${pending.id}.lock`), "");
    await queue.touchLockAge(pending.id, 200_000);

    const runningJob = await queue.enqueue({ projectId: "p1", type: "analyze", params: {} });
    const claimed = await queue.claimNext(["analyze"], WORKER_A);
    expect(claimed?.id).toBe(runningJob.id);

    const affected = await queue.recoverStale();
    expect(await lockExists(dir, pending.id)).toBe(false);
    const stillRunning = await queue.get(runningJob.id);
    expect(stillRunning?.status).toBe("running");
    expect(await lockExists(dir, runningJob.id)).toBe(true);
    expect(affected.some((j) => j.id === pending.id)).toBe(true);
  });

  it("recoverStale full mode fails expired render (maxRequeues=0)", async () => {
    const fullQueue = new FileJobQueue({
      backend: "file",
      dir,
      leaseMs: 1000,
      leaseRecoveryEnabled: true,
      maxRequeuesRender: 0,
      maxRequeuesAudio: 1,
    });
    const job = await fullQueue.enqueue({ projectId: "p1", type: "render", params: {} });
    const claimed = await fullQueue.claimNext(["render"], WORKER_A);
    expect(claimed).not.toBeNull();
    // Backdate heartbeat via rewrite.
    const stale = {
      ...(await fullQueue.get(job.id))!,
      claimedAt: new Date(Date.now() - 60_000).toISOString(),
      heartbeatAt: new Date(Date.now() - 60_000).toISOString(),
    };
    await writeFile(join(dir, `${job.id}.json`), JSON.stringify(stale, null, 2));

    await fullQueue.recoverStale();
    const after = await fullQueue.get(job.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toMatch(/stale lease/i);
    expect(await lockExists(dir, job.id)).toBe(false);
  });

  it("late markCompleted after reclaim is fenced out", async () => {
    const fullQueue = new FileJobQueue({
      backend: "file",
      dir,
      leaseMs: 1000,
      leaseRecoveryEnabled: true,
      maxRequeuesAudio: 1,
      maxRequeuesRender: 0,
    });
    const job = await fullQueue.enqueue({ projectId: "p1", type: "transcribe", params: {} });
    const first = await fullQueue.claimNext(["transcribe"], WORKER_A);
    expect(first).not.toBeNull();
    const stale = {
      ...(await fullQueue.get(job.id))!,
      claimedAt: new Date(Date.now() - 60_000).toISOString(),
      heartbeatAt: new Date(Date.now() - 60_000).toISOString(),
    };
    await writeFile(join(dir, `${job.id}.json`), JSON.stringify(stale, null, 2));
    await fullQueue.recoverStale();
    const second = await fullQueue.claimNext(["transcribe"], WORKER_B);
    expect(second?.claimedBy).toBe(WORKER_B.workerId);
    expect(second?.claimGeneration).toBe(1);

    await expect(
      fullQueue.markCompleted(job.id, ["x"], own(first!)),
    ).rejects.toBeInstanceOf(OwnershipError);
    const final = await fullQueue.get(job.id);
    expect(final?.status).toBe("running");
    expect(final?.claimedBy).toBe(WORKER_B.workerId);
  });

  it("createJobQueue builds a FileJobQueue from config", () => {
    const created = createJobQueue({ backend: "file", dir });
    expect(created).toBeInstanceOf(FileJobQueue);
  });

  it("throws on an unknown queue backend", () => {
    expect(() =>
      createJobQueue({ backend: "redis" as unknown as "file", dir }),
    ).toThrow(/Unknown queue backend/);
  });
});
