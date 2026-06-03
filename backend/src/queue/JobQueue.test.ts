import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileJobQueue, createJobQueue, type JobQueue } from "./JobQueue.js";

/**
 * Minimal sanity unit tests for the Job_Queue (Req 12.1–12.4, 15.3).
 * The exhaustive lifecycle property tests live in tasks 2.4 and 2.5.
 */
describe("FileJobQueue", () => {
  let dir: string;
  let queue: JobQueue;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mv-jobs-"));
    queue = new FileJobQueue(dir);
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

    const claimed = await queue.claimNext(["transcribe", "analyze"]);
    expect(claimed?.id).toBe(transcribe.id);
    expect(claimed?.status).toBe("running");

    // Already running, so a second claim of the same types finds nothing.
    expect(await queue.claimNext(["transcribe", "analyze"])).toBeNull();
  });

  it("never lets two claims take the same job", async () => {
    await queue.enqueue({ projectId: "p1", type: "render", params: {} });
    const [first, second] = await Promise.all([
      queue.claimNext(["render"]),
      queue.claimNext(["render"]),
    ]);
    const claimed = [first, second].filter((j) => j !== null);
    expect(claimed).toHaveLength(1);
  });

  it("records produced artifacts on completion (Req 12.3)", async () => {
    const job = await queue.enqueue({ projectId: "p1", type: "render", params: {} });
    await queue.markRunning(job.id);
    const done = await queue.markCompleted(job.id, [
      "artifacts/final-16x9-fullhd-60fps.mp4",
      "artifacts/final-9x16-fullhd-60fps.mp4",
    ]);
    expect(done.status).toBe("completed");
    expect(done.artifacts).toEqual([
      "artifacts/final-16x9-fullhd-60fps.mp4",
      "artifacts/final-9x16-fullhd-60fps.mp4",
    ]);
  });

  it("retains the error message on failure (Req 12.4)", async () => {
    const job = await queue.enqueue({ projectId: "p1", type: "analyze", params: {} });
    const failed = await queue.markFailed(job.id, "decode error");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("decode error");
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
