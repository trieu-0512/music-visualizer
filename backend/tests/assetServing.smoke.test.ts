import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";

/**
 * Smoke coverage for the asset-serving route wired in task 13.1
 * (`GET /projects/:id/assets/*`). The in-browser preview and a headless render
 * load a project's stored assets by URL; this confirms the bytes stream out of
 * the Asset_Store with a sensible content type and that missing assets / paths
 * resolve to a NOT_FOUND envelope (Req 8.x preview support, Req 1.5).
 */
describe("asset serving endpoint smoke (Req 8.x preview)", () => {
  let root: string;
  let store: AssetStore;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-asset-serve-"));
    store = new LocalAssetStore(root);
    app = createApp({ projectService: new ProjectService(store), store });
    const created = await request(app)
      .post("/projects")
      .send({ songName: "Twinkle", singerName: "Choir", videoFormat: "both" });
    projectId = created.body.projectId;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("serves a stored top-level asset with the right content type", async () => {
    await store.write({ projectId, relativePath: "assets/background.jpg" }, Buffer.from("JPGBYTES"));
    const res = await request(app).get(`/projects/${projectId}/assets/background.jpg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/jpeg/);
    expect(res.body.toString()).toBe("JPGBYTES");
  });

  it("serves a nested letter SVG asset (Req 2.1)", async () => {
    await store.write(
      { projectId, relativePath: "assets/letters/T.svg" },
      Buffer.from("<svg>T</svg>"),
    );
    const res = await request(app)
      .get(`/projects/${projectId}/assets/letters/T.svg`)
      .buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
    // supertest buffers non-text content types into res.body (a Buffer), so
    // assert on the buffered bytes rather than res.text (undefined for svg).
    expect(res.body.toString()).toBe("<svg>T</svg>");
  });

  it("returns NOT_FOUND for a stored asset that is absent", async () => {
    const res = await request(app).get(`/projects/${projectId}/assets/background.jpg`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for an unknown project (Req 1.5)", async () => {
    const res = await request(app).get(`/projects/missing/assets/background.jpg`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("does not let a traversal path escape the project scope", async () => {
    const res = await request(app).get(`/projects/${projectId}/assets/../../project.json`);
    // Express normalizes/decodes; the store rejects escapes, surfaced as 404.
    expect(res.status).toBe(404);
  });

  it("keeps the readiness route reachable alongside the asset wildcard (Req 2.8)", async () => {
    const res = await request(app).get(`/projects/${projectId}/readiness`);
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(projectId);
    expect(Array.isArray(res.body.missing)).toBe(true);
  });
});
