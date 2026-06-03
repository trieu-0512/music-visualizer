import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { validateProjectConfig } from "@music-visualizer/shared";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";

/**
 * End-to-end smoke coverage for the config BUILD endpoint wired in task 13.1
 * (`POST /projects/:id/config`, Req 7.1, 7.7). This is the runnable
 * config-generation step the preview and render stages depend on. Exhaustive
 * Config_Builder property coverage lives in tasks 4.2 / 4.3; these examples
 * confirm the route assembles + persists a schema-valid config and reports
 * missing items through the documented envelope.
 */

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Write the full set of required assets + artifacts so the build succeeds. */
async function seedComplete(store: AssetStore, projectId: string): Promise<void> {
  await store.write({ projectId, relativePath: "assets/background.jpg" }, Buffer.from("bg"));
  await store.write({ projectId, relativePath: "assets/song-logo.png" }, Buffer.from("sl"));
  await store.write({ projectId, relativePath: "assets/channel-logo.png" }, Buffer.from("cl"));
  await store.write({ projectId, relativePath: "assets/audio.mp3" }, Buffer.from("au"));
  for (const letter of LETTERS) {
    await store.write(
      { projectId, relativePath: `assets/letters/${letter}.svg` },
      Buffer.from(`<svg>${letter}</svg>`),
    );
  }
  await store.write({ projectId, relativePath: "artifacts/lyrics.json" }, Buffer.from("{}"));
  await store.write(
    { projectId, relativePath: "artifacts/audio-analysis.json" },
    Buffer.from("{}"),
  );
}

describe("config build endpoint smoke (Req 7.1, 7.7)", () => {
  let root: string;
  let store: AssetStore;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-config-build-"));
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

  it("builds and persists a schema-valid config when complete (Req 7.1)", async () => {
    await seedComplete(store, projectId);

    const res = await request(app).post(`/projects/${projectId}/config`);
    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(projectId);
    expect(validateProjectConfig(res.body).ok).toBe(true);

    // The config is now retrievable for preview (Req 8.1).
    const get = await request(app).get(`/projects/${projectId}/config`);
    expect(get.status).toBe(200);
    expect(get.body.projectId).toBe(projectId);
  });

  it("rejects with MISSING_REQUIREMENTS listing each missing item (Req 7.7)", async () => {
    await seedComplete(store, projectId);
    await store.delete({ projectId, relativePath: "assets/audio.mp3" });
    await store.delete({ projectId, relativePath: "assets/letters/Q.svg" });

    const res = await request(app).post(`/projects/${projectId}/config`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MISSING_REQUIREMENTS");
    const missing = res.body.error.details.missing as string[];
    expect(missing).toContain("audio");
    expect(missing).toContain("letter:Q");

    // Nothing was written on rejection.
    const get = await request(app).get(`/projects/${projectId}/config`);
    expect(get.status).toBe(409);
    expect(get.body.error.code).toBe("ARTIFACT_NOT_READY");
  });

  it("returns NOT_FOUND building config for an unknown project (Req 1.5)", async () => {
    const res = await request(app).post(`/projects/missing/config`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
