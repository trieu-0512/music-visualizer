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
 * Minimal end-to-end smoke coverage for the artifact listing/download and
 * config retrieval endpoints (Req 11.1, 11.2, 11.4, 8.1, 8.5). Exhaustive
 * artifact-listing property coverage (Property 13) lives in task 4.5.
 */
describe("artifact + config endpoints smoke (Req 11, Req 8)", () => {
  let root: string;
  let store: AssetStore;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-artifacts-"));
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

  it("lists no artifacts for a fresh project (Req 11.1)", async () => {
    const res = await request(app).get(`/projects/${projectId}/artifacts`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts).toEqual([]);
  });

  it("lists only present standardized artifacts in catalog order (Req 11.1)", async () => {
    await store.write({ projectId, relativePath: "artifacts/audio-analysis.json" }, Buffer.from("{}"));
    await store.write({ projectId, relativePath: "artifacts/lyrics.json" }, Buffer.from("{}"));
    // A non-standardized file under artifacts/ must be ignored.
    await store.write({ projectId, relativePath: "artifacts/notes.txt" }, Buffer.from("x"));

    const res = await request(app).get(`/projects/${projectId}/artifacts`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts).toEqual(["lyrics.json", "audio-analysis.json"]);
  });

  it("downloads a present artifact with a sensible content type (Req 11.2)", async () => {
    await store.write({ projectId, relativePath: "artifacts/lyrics.srt" }, Buffer.from("1\n"));
    const res = await request(app).get(`/projects/${projectId}/artifacts/lyrics.srt`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/subrip/);
    expect(res.text).toBe("1\n");
  });

  it("returns ARTIFACT_NOT_READY for an artifact not yet generated (Req 11.4)", async () => {
    const res = await request(app).get(`/projects/${projectId}/artifacts/lyrics.json`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ARTIFACT_NOT_READY");
  });

  it("returns NOT_FOUND for an unknown artifact name (Req 11.3)", async () => {
    const res = await request(app).get(`/projects/${projectId}/artifacts/unknown.bin`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for an unknown project (Req 1.5)", async () => {
    const list = await request(app).get(`/projects/missing/artifacts`);
    expect(list.status).toBe(404);
    expect(list.body.error.code).toBe("NOT_FOUND");
    const download = await request(app).get(`/projects/missing/artifacts/lyrics.json`);
    expect(download.status).toBe(404);
    expect(download.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the config artifact when present (Req 8.1)", async () => {
    const config = { version: 1, projectId };
    await store.write(
      { projectId, relativePath: "artifacts/project-config.json" },
      Buffer.from(JSON.stringify(config)),
    );
    const res = await request(app).get(`/projects/${projectId}/config`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual(config);
  });

  it("signals ARTIFACT_NOT_READY when no config has been generated (Req 8.5)", async () => {
    const res = await request(app).get(`/projects/${projectId}/config`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ARTIFACT_NOT_READY");
    expect(res.body.error.message).toMatch(/configuration must be generated/i);
  });

  it("returns NOT_FOUND requesting config of an unknown project (Req 1.5)", async () => {
    const res = await request(app).get(`/projects/missing/config`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
