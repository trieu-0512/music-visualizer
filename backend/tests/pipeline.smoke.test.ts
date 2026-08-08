import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ProjectService } from "../src/projects/index.js";
import { FileJobQueue } from "../src/queue/JobQueue.js";
import { LocalAssetStore } from "../src/storage/index.js";

describe("persistent pipeline endpoints", () => {
  let root: string;
  let jobsDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-pipeline-api-"));
    jobsDir = await mkdtemp(join(tmpdir(), "mv-pipeline-jobs-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(jobsDir, { recursive: true, force: true });
  });

  it("persists a run across API app recreation and does not duplicate child jobs", async () => {
    const store = new LocalAssetStore(root);
    const projects = new ProjectService(store, () => "p1");
    const queue = new FileJobQueue(jobsDir);
    await projects.create({ songName: "ABC", singerName: "Kids", videoFormat: "both" });
    await store.write(
      { projectId: "p1", relativePath: "assets/audio.mp3" },
      Buffer.from("audio"),
    );

    const app = createApp({ store, projectService: projects, jobQueue: queue });
    const started = await request(app)
      .post("/projects/p1/pipeline")
      .send({ format: "portrait" });

    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({
      projectId: "p1",
      status: "running",
      step: "transcribe-analyze",
      renderFormat: "portrait",
    });
    expect(started.body.jobs.transcribe).toBeTruthy();
    expect(started.body.jobs.analyze).toBeTruthy();
    expect(await queue.listByProject("p1")).toHaveLength(2);

    // Recreate the API layer as if the process restarted. Runtime state lives
    // in the project store, while child jobs remain in the durable queue.
    const restartedApp = createApp({ store, projectService: projects, jobQueue: queue });
    const resumed = await request(restartedApp).get("/projects/p1/pipeline");
    expect(resumed.status).toBe(200);
    expect(resumed.body.id).toBe(started.body.id);
    expect(resumed.body.status).toBe("running");
    expect(await queue.listByProject("p1")).toHaveLength(2);
  });

  it("rejects starting a second active pipeline", async () => {
    const store = new LocalAssetStore(root);
    const projects = new ProjectService(store, () => "p1");
    const queue = new FileJobQueue(jobsDir);
    await projects.create({ songName: "ABC", singerName: "Kids", videoFormat: "both" });
    await store.write(
      { projectId: "p1", relativePath: "assets/audio.mp3" },
      Buffer.from("audio"),
    );
    const app = createApp({ store, projectService: projects, jobQueue: queue });

    expect((await request(app).post("/projects/p1/pipeline").send({})).status).toBe(201);
    const duplicate = await request(app).post("/projects/p1/pipeline").send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("PRECONDITION_FAILED");
  });
});
