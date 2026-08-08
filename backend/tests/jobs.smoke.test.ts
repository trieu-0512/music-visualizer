import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { FileJobQueue, type JobQueue } from "../src/queue/JobQueue.js";
import { ProjectService } from "../src/projects/index.js";

/**
 * Minimal end-to-end smoke coverage for the job enqueue/status endpoints
 * (Req 3.1, 6.1, 9.1, 12.1, 12.2) and the precondition envelopes (Req 3.5,
 * 6.7, 9.5). Exhaustive error-envelope/precondition unit coverage lives in
 * task 4.7; these examples confirm the happy path enqueues and reports status
 * and that each precondition gate rejects with the documented code.
 */
describe("job endpoints smoke (Req 3, 6, 9, 12)", () => {
  let root: string;
  let jobsDir: string;
  let store: AssetStore;
  let queue: JobQueue;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-jobs-store-"));
    jobsDir = await mkdtemp(join(tmpdir(), "mv-jobs-queue-"));
    store = new LocalAssetStore(root);
    queue = new FileJobQueue(jobsDir);
    app = createApp({ projectService: new ProjectService(store), store, jobQueue: queue });
    const created = await request(app)
      .post("/projects")
      .send({ songName: "Twinkle", singerName: "Choir", videoFormat: "both" });
    projectId = created.body.projectId;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(jobsDir, { recursive: true, force: true });
  });

  it("requires mapping before enqueueing prepare-assets and accepts it afterward", async () => {
    const missing = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "prepare-assets" });
    expect(missing.status).toBe(409);
    expect(missing.body.error.code).toBe("PRECONDITION_FAILED");

    const mapping = {
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
    };
    await store.write(
      { projectId, relativePath: "authoring/mapping.json" },
      Buffer.from(JSON.stringify(mapping)),
    );
    const created = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "prepare-assets" });
    expect(created.status).toBe(201);
    expect(created.body.type).toBe("prepare-assets");
    expect(created.body.status).toBe("pending");
  });

  it("enqueues a transcribe job once an Audio_Asset is stored (Req 3.1, 12.1)", async () => {
    await store.write({ projectId, relativePath: "assets/audio.mp3" }, Buffer.from("au"));
    const res = await request(app).post(`/projects/${projectId}/jobs`).send({ type: "transcribe" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.type).toBe("transcribe");
    expect(res.body.status).toBe("pending");
    expect(res.body.projectId).toBe(projectId);
  });

  it("enqueues a render job once a config artifact exists (Req 9.1, 12.1)", async () => {
    await store.write(
      { projectId, relativePath: "artifacts/project-config.json" },
      Buffer.from("{}"),
    );
    const res = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "render", params: { format: "both" } });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("render");
    expect(res.body.params).toEqual({ format: "both" });
  });

  it("rejects transcribe/analyze with PRECONDITION_FAILED when no audio (Req 3.5, 6.7)", async () => {
    const transcribe = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "transcribe" });
    expect(transcribe.status).toBe(409);
    expect(transcribe.body.error.code).toBe("PRECONDITION_FAILED");
    expect(transcribe.body.error.message).toMatch(/audio_asset is required/i);

    const analyze = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "analyze" });
    expect(analyze.status).toBe(409);
    expect(analyze.body.error.code).toBe("PRECONDITION_FAILED");
  });

  it("rejects render with PRECONDITION_FAILED when no config (Req 9.5)", async () => {
    const res = await request(app).post(`/projects/${projectId}/jobs`).send({ type: "render" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PRECONDITION_FAILED");
    expect(res.body.error.message).toMatch(/configuration must be generated/i);
  });

  it("rejects an unknown job type with VALIDATION_ERROR", async () => {
    const res = await request(app).post(`/projects/${projectId}/jobs`).send({ type: "bogus" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns NOT_FOUND enqueuing a job for an unknown project (Req 1.5)", async () => {
    const res = await request(app).post(`/projects/missing/jobs`).send({ type: "transcribe" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the job status by id (Req 12.2)", async () => {
    await store.write({ projectId, relativePath: "assets/audio.wav" }, Buffer.from("au"));
    const created = await request(app)
      .post(`/projects/${projectId}/jobs`)
      .send({ type: "analyze" });
    const jobId = created.body.id;

    const res = await request(app).get(`/jobs/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(res.body.status).toBe("pending");
  });

  it("returns NOT_FOUND for an unknown job id (Req 12.2)", async () => {
    const res = await request(app).get(`/jobs/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("lists jobs for a project (GET /projects/:id/jobs, PR-09)", async () => {
    await store.write({ projectId, relativePath: "assets/audio.mp3" }, Buffer.from("au"));
    const a = await request(app).post(`/projects/${projectId}/jobs`).send({ type: "transcribe" });
    const b = await request(app).post(`/projects/${projectId}/jobs`).send({ type: "analyze" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const listed = await request(app).get(`/projects/${projectId}/jobs`);
    expect(listed.status).toBe(200);
    expect(listed.body.jobs).toHaveLength(2);
    const ids = listed.body.jobs.map((j: { id: string }) => j.id);
    expect(ids).toEqual(expect.arrayContaining([a.body.id, b.body.id]));
    for (const job of listed.body.jobs) {
      expect(job.projectId).toBe(projectId);
      expect(["transcribe", "analyze"]).toContain(job.type);
    }

    const missing = await request(app).get(`/projects/does-not-exist/jobs`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });
});
