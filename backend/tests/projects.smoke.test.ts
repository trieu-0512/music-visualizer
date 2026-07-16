import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";

/**
 * Minimal end-to-end smoke coverage for the project endpoints (Req 1.1, 1.4,
 * 1.5). Exhaustive unit tests live in task 3.2.
 */
describe("project endpoints smoke (Req 1)", () => {
  let root: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-projects-"));
    const store = new LocalAssetStore(root);
    app = createApp({ projectService: new ProjectService(store), store });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates a project then returns its metadata, assets, and artifacts", async () => {
    const created = await request(app)
      .post("/projects")
      .send({ songName: "Twinkle Star", singerName: "Kids Choir", videoFormat: "both" });

    expect(created.status).toBe(201);
    expect(created.body.projectId).toMatch(/\S/);
    expect(created.body.songName).toBe("Twinkle Star");

    const view = await request(app).get(`/projects/${created.body.projectId}`);
    expect(view.status).toBe(200);
    expect(view.body.metadata).toEqual({
      songName: "Twinkle Star",
      singerName: "Kids Choir",
      videoFormat: "both",
    });
    expect(view.body.assets).toEqual([]);
    expect(view.body.artifacts).toEqual([]);
  });

  it("returns a NOT_FOUND envelope for an unknown project id (Req 1.5)", async () => {
    const res = await request(app).get("/projects/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("does-not-exist");
  });

  it("lists projects newest-first (GET /projects, PR-09)", async () => {
    const empty = await request(app).get("/projects");
    expect(empty.status).toBe(200);
    expect(empty.body.projects).toEqual([]);

    const first = await request(app)
      .post("/projects")
      .send({ songName: "Older", singerName: "A", videoFormat: "landscape" });
    // Ensure a distinguishable createdAt ordering on coarse clocks.
    await new Promise((r) => setTimeout(r, 5));
    const second = await request(app)
      .post("/projects")
      .send({ songName: "Newer", singerName: "B", videoFormat: "portrait" });

    const listed = await request(app).get("/projects");
    expect(listed.status).toBe(200);
    expect(listed.body.projects).toHaveLength(2);
    expect(listed.body.projects[0].projectId).toBe(second.body.projectId);
    expect(listed.body.projects[0].songName).toBe("Newer");
    expect(listed.body.projects[1].projectId).toBe(first.body.projectId);
    expect(listed.body.projects[1]).toMatchObject({
      projectId: first.body.projectId,
      songName: "Older",
      singerName: "A",
      videoFormat: "landscape",
    });
    expect(listed.body.projects[0].createdAt).toBeTruthy();
  });
});
