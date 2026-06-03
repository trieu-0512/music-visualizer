import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import {
  ProjectService,
  type ProjectIdFactory,
  type ProjectMetadata,
} from "../src/projects/index.js";
import { ApiError } from "../src/http/errors.js";

/**
 * Example-based unit tests for project creation and retrieval (task 3.2).
 *
 * Covers three behaviours required by Requirement 1:
 *   1. Unique `Project_Id` generation (Req 1.1)
 *   2. Project_Metadata round-trip: create then read returns the same
 *      songName/singerName/videoFormat (Req 1.2)
 *   3. Not-found error code and message identifying the missing id (Req 1.5)
 *
 * Each test builds a fresh {@link LocalAssetStore} rooted in an OS temp
 * directory and removes it afterward so runs never share state on disk.
 */

const SAMPLE_METADATA: ProjectMetadata = {
  songName: "Twinkle Star",
  singerName: "Kids Choir",
  videoFormat: "both",
};

describe("ProjectService create and retrieval (Req 1)", () => {
  let root: string;
  let store: AssetStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-projects-unit-"));
    store = new LocalAssetStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("unique Project_Id generation (Req 1.1)", () => {
    it("assigns a distinct Project_Id to each created project", async () => {
      const service = new ProjectService(store);
      const count = 25;

      const ids = new Set<string>();
      for (let i = 0; i < count; i += 1) {
        const record = await service.create(SAMPLE_METADATA);
        expect(record.projectId).toMatch(/\S/); // non-empty
        ids.add(record.projectId);
      }

      // No two projects may share an id.
      expect(ids.size).toBe(count);
    });

    it("regenerates the id when a candidate already addresses a stored record", async () => {
      // The factory hands out a colliding candidate before a fresh one; the
      // service must skip the taken id and allocate the unique one.
      const candidates = ["taken", "taken", "fresh"];
      const idFactory: ProjectIdFactory = () => candidates.shift() as string;
      const service = new ProjectService(store, idFactory);

      const first = await service.create(SAMPLE_METADATA);
      const second = await service.create(SAMPLE_METADATA);

      expect(first.projectId).toBe("taken");
      expect(second.projectId).toBe("fresh");
      expect(first.projectId).not.toBe(second.projectId);
    });
  });

  describe("Project_Metadata round-trip (Req 1.2)", () => {
    it("records the supplied metadata and returns it unchanged from getView", async () => {
      const service = new ProjectService(store);

      const created = await service.create(SAMPLE_METADATA);
      expect(created.songName).toBe(SAMPLE_METADATA.songName);
      expect(created.singerName).toBe(SAMPLE_METADATA.singerName);
      expect(created.videoFormat).toBe(SAMPLE_METADATA.videoFormat);

      const view = await service.getView(created.projectId);
      expect(view.projectId).toBe(created.projectId);
      expect(view.metadata).toEqual(SAMPLE_METADATA);
      // A freshly created project has no stored assets or artifacts yet (Req 1.4).
      expect(view.assets).toEqual([]);
      expect(view.artifacts).toEqual([]);
    });

    it.each(["landscape", "portrait", "both"] as const)(
      "preserves videoFormat=%s through create then getView",
      async (videoFormat) => {
        const service = new ProjectService(store);
        const created = await service.create({
          songName: "Song",
          singerName: "Singer",
          videoFormat,
        });
        const view = await service.getView(created.projectId);
        expect(view.metadata.videoFormat).toBe(videoFormat);
      },
    );
  });

  describe("not-found for unknown Project_Id (Req 1.5)", () => {
    it("throws a NOT_FOUND ApiError naming the missing id", async () => {
      const service = new ProjectService(store);

      await expect(service.getView("missing-id")).rejects.toBeInstanceOf(ApiError);
      try {
        await service.getView("missing-id");
        expect.unreachable("getView should reject for an unknown project id");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.code).toBe("NOT_FOUND");
        expect(apiError.status).toBe(404);
        expect(apiError.message).toContain("missing-id");
        expect(apiError.details).toEqual({ projectId: "missing-id" });
      }
    });

    it("returns null from get for an unknown project id", async () => {
      const service = new ProjectService(store);
      expect(await service.get("nope")).toBeNull();
    });
  });
});

describe("project endpoints create and retrieval over HTTP (Req 1)", () => {
  let root: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-projects-http-"));
    const store = new LocalAssetStore(root);
    app = createApp({ projectService: new ProjectService(store), store });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("assigns a unique Project_Id across repeated POST /projects (Req 1.1)", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const created = await request(app).post("/projects").send(SAMPLE_METADATA);
      expect(created.status).toBe(201);
      expect(created.body.projectId).toMatch(/\S/);
      ids.add(created.body.projectId);
    }
    expect(ids.size).toBe(10);
  });

  it("round-trips metadata through POST then GET (Req 1.2)", async () => {
    const created = await request(app)
      .post("/projects")
      .send({ songName: "Lullaby", singerName: "Choir A", videoFormat: "portrait" });
    expect(created.status).toBe(201);

    const view = await request(app).get(`/projects/${created.body.projectId}`);
    expect(view.status).toBe(200);
    expect(view.body.metadata).toEqual({
      songName: "Lullaby",
      singerName: "Choir A",
      videoFormat: "portrait",
    });
  });

  it("returns a NOT_FOUND envelope identifying the missing id (Req 1.5)", async () => {
    const res = await request(app).get("/projects/unknown-123");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("unknown-123");
    expect(res.body.error.details).toEqual({ projectId: "unknown-123" });
  });
});
