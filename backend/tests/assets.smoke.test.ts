import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";
import { REQUIRED_ROLES } from "../src/assets/index.js";

/**
 * Minimal end-to-end smoke coverage for the asset endpoints (Req 2.1–2.8).
 * Exhaustive property coverage lives in tasks 3.4 (upload validation) and 3.5
 * (readiness).
 */
describe("asset endpoints smoke (Req 2)", () => {
  let root: string;
  let store: AssetStore;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-assets-"));
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

  it("uploads an audio asset and stores it at the standardized path (Req 2.3)", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/assets/audio`)
      .attach("file", Buffer.from("ID3 fake mp3"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      });
    expect(res.status).toBe(201);
    expect(res.body.path).toBe("assets/audio.mp3");
    expect(await store.exists({ projectId, relativePath: "assets/audio.mp3" })).toBe(true);
  });

  it("stores a letter asset keyed A–Z at assets/letters/{X}.svg (Req 2.1)", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/assets/letter:A`)
      .attach("file", Buffer.from("<svg/>"), {
        filename: "alpha.svg",
        contentType: "image/svg+xml",
      });
    expect(res.status).toBe(201);
    expect(res.body.path).toBe("assets/letters/A.svg");
  });

  it("validates and stores a theme-first learning map upload", async () => {
    const letters = Object.fromEntries(
      [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => [letter, { object: `Object ${letter}` }]),
    );
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
      letters,
    };
    const res = await request(app)
      .post(`/projects/${projectId}/assets/learningMap`)
      .attach("file", Buffer.from(JSON.stringify(mapping)), {
        filename: "mapping.json",
        contentType: "application/json",
      });
    expect(res.status).toBe(201);
    expect(res.body.path).toBe("authoring/mapping.json");
    expect(await store.exists({ projectId, relativePath: "authoring/mapping.json" })).toBe(true);
  });

  it("rejects a learning map that does not satisfy the canonical schema", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/assets/learningMap`)
      .attach("file", Buffer.from(JSON.stringify({ version: 1, theme: {}, letters: {} })), {
        filename: "mapping.json",
        contentType: "application/json",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await store.exists({ projectId, relativePath: "authoring/mapping.json" })).toBe(false);
  });

  it("rejects a non-MP3/WAV audio upload with UNSUPPORTED_FORMAT (Req 2.4)", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/assets/audio`)
      .attach("file", Buffer.from("not audio"), {
        filename: "song.ogg",
        contentType: "audio/ogg",
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNSUPPORTED_FORMAT");
    expect(res.body.error.message).toMatch(/MP3 or WAV/);
  });

  it("rejects a type/role mismatch with TYPE_MISMATCH (Req 2.6)", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/assets/background`)
      .attach("file", Buffer.from("<svg/>"), {
        filename: "bg.svg",
        contentType: "image/svg+xml",
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("TYPE_MISMATCH");
    expect(res.body.error.message).toMatch(/expects/);
  });

  it("replaces the stored file on re-upload, leaving one file per role (Req 2.7)", async () => {
    await request(app)
      .post(`/projects/${projectId}/assets/audio`)
      .attach("file", Buffer.from("first"), { filename: "a.mp3", contentType: "audio/mpeg" });
    await request(app)
      .post(`/projects/${projectId}/assets/audio`)
      .attach("file", Buffer.from("second"), { filename: "b.wav", contentType: "audio/wav" });

    // The earlier .mp3 must be gone; only the .wav remains for the audio role.
    expect(await store.exists({ projectId, relativePath: "assets/audio.mp3" })).toBe(false);
    const wav = await store.read({ projectId, relativePath: "assets/audio.wav" });
    expect(wav.toString()).toBe("second");
  });

  it("returns NOT_FOUND when uploading to an unknown project (Req 1.5)", async () => {
    const res = await request(app)
      .post(`/projects/missing/assets/audio`)
      .attach("file", Buffer.from("x"), { filename: "a.mp3", contentType: "audio/mpeg" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("reports all required roles missing for a fresh project, then present once uploaded (Req 2.8)", async () => {
    const before = await request(app).get(`/projects/${projectId}/readiness`);
    expect(before.status).toBe(200);
    expect(before.body.ready).toBe(false);
    expect(before.body.present).toEqual([]);
    expect(before.body.missing).toEqual(REQUIRED_ROLES);

    await request(app)
      .post(`/projects/${projectId}/assets/audio`)
      .attach("file", Buffer.from("x"), { filename: "a.mp3", contentType: "audio/mpeg" });

    const after = await request(app).get(`/projects/${projectId}/readiness`);
    expect(after.body.present).toEqual(["audio"]);
    expect(after.body.missing).not.toContain("audio");
    expect(after.body.missing).toContain("letter:Z");
  });
});
