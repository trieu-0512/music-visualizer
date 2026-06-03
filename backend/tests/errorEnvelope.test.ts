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
import {
  ApiError,
  ERROR_STATUS,
  notFound,
  validationError,
  type ApiErrorCode,
} from "../src/http/errors.js";

/**
 * Example-based unit tests for the uniform API error envelope and the
 * documented precondition codes (task 4.7).
 *
 * Two layers of coverage:
 *   1. Direct {@link ApiError} unit assertions — every documented code maps to
 *      the right HTTP status and serializes to the uniform envelope shape
 *      `{ error: { code, message, details? } }`.
 *   2. End-to-end assertions through {@link createApp} + supertest — each route
 *      that surfaces an error returns the correct code, HTTP status, and a
 *      helpful message, with the same envelope shape on the wire.
 *
 * Covers: NOT_FOUND (Req 1.5), UNSUPPORTED_FORMAT (Req 2.4 / audio precondition
 * 3.5), TYPE_MISMATCH (Req 2.6), PRECONDITION_FAILED (Req 3.5, 6.7, 9.5), and
 * ARTIFACT_NOT_READY (Req 8.5, 11.4).
 */

/** Assert a response body matches the uniform envelope shape for `code`. */
function expectEnvelope(body: unknown, code: ApiErrorCode): void {
  expect(body).toBeTypeOf("object");
  const envelope = body as { error?: { code?: unknown; message?: unknown; details?: unknown } };
  expect(envelope.error).toBeTypeOf("object");
  expect(envelope.error?.code).toBe(code);
  // A helpful, non-empty human-readable message is always present.
  expect(typeof envelope.error?.message).toBe("string");
  expect((envelope.error?.message as string).length).toBeGreaterThan(0);
  // The envelope carries no keys other than the documented three.
  expect(Object.keys(envelope.error as object).sort()).toEqual(
    "details" in (envelope.error as object)
      ? ["code", "details", "message"]
      : ["code", "message"],
  );
  // Only the documented top-level `error` key is present.
  expect(Object.keys(envelope as object)).toEqual(["error"]);
}

describe("ApiError model and envelope (unit)", () => {
  it("maps each documented code to its HTTP status", () => {
    expect(ERROR_STATUS.NOT_FOUND).toBe(404);
    expect(ERROR_STATUS.VALIDATION_ERROR).toBe(400);
    expect(ERROR_STATUS.UNSUPPORTED_FORMAT).toBe(422);
    expect(ERROR_STATUS.TYPE_MISMATCH).toBe(422);
    expect(ERROR_STATUS.PRECONDITION_FAILED).toBe(409);
    expect(ERROR_STATUS.MISSING_REQUIREMENTS).toBe(422);
    expect(ERROR_STATUS.ARTIFACT_NOT_READY).toBe(409);
  });

  it("derives status from code and serializes details when present", () => {
    const err = new ApiError("PRECONDITION_FAILED", "needs audio", { projectId: "p1" });
    expect(err.status).toBe(409);
    expect(err.toEnvelope()).toEqual({
      error: { code: "PRECONDITION_FAILED", message: "needs audio", details: { projectId: "p1" } },
    });
  });

  it("omits the details key entirely when no details are supplied", () => {
    const env = new ApiError("ARTIFACT_NOT_READY", "not ready").toEnvelope();
    expect(env).toEqual({ error: { code: "ARTIFACT_NOT_READY", message: "not ready" } });
    expect("details" in env.error).toBe(false);
  });

  it("builds NOT_FOUND and VALIDATION_ERROR via their helpers", () => {
    const nf = notFound("missing thing", { id: "x" });
    expect(nf.code).toBe("NOT_FOUND");
    expect(nf.status).toBe(404);
    expect(nf.details).toEqual({ id: "x" });

    const ve = validationError("bad input");
    expect(ve.code).toBe("VALIDATION_ERROR");
    expect(ve.status).toBe(400);
  });
});

describe("error envelope end-to-end (Req 1.5, 2.4, 2.6, 3.5, 6.7, 8.5, 9.5, 11.4)", () => {
  let root: string;
  let jobsDir: string;
  let store: AssetStore;
  let queue: JobQueue;
  let app: ReturnType<typeof createApp>;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-errenv-store-"));
    jobsDir = await mkdtemp(join(tmpdir(), "mv-errenv-queue-"));
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

  describe("NOT_FOUND (Req 1.5)", () => {
    it("returns NOT_FOUND naming the missing project id", async () => {
      const res = await request(app).get("/projects/ghost-project");
      expect(res.status).toBe(404);
      expectEnvelope(res.body, "NOT_FOUND");
      expect(res.body.error.message).toContain("ghost-project");
      expect(res.body.error.details).toEqual({ projectId: "ghost-project" });
    });

    it("returns NOT_FOUND for an unknown job id", async () => {
      const res = await request(app).get("/jobs/no-such-job");
      expect(res.status).toBe(404);
      expectEnvelope(res.body, "NOT_FOUND");
      expect(res.body.error.message).toContain("no-such-job");
    });

    it("returns NOT_FOUND for an unknown (non-standardized) artifact name", async () => {
      const res = await request(app).get(`/projects/${projectId}/artifacts/mystery.bin`);
      expect(res.status).toBe(404);
      expectEnvelope(res.body, "NOT_FOUND");
      expect(res.body.error.message).toContain("mystery.bin");
    });

    it("returns NOT_FOUND for an unmatched route via the terminal handler", async () => {
      const res = await request(app).get("/no/such/route");
      expect(res.status).toBe(404);
      expectEnvelope(res.body, "NOT_FOUND");
    });
  });

  describe("UNSUPPORTED_FORMAT (Req 2.4)", () => {
    it("rejects a non-MP3/WAV audio upload and states the accepted formats", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/assets/audio`)
        .attach("file", Buffer.from("not audio"), {
          filename: "song.ogg",
          contentType: "audio/ogg",
        });
      expect(res.status).toBe(422);
      expectEnvelope(res.body, "UNSUPPORTED_FORMAT");
      expect(res.body.error.message).toMatch(/MP3 or WAV/i);
      expect(res.body.error.details).toMatchObject({ role: "audio" });
    });
  });

  describe("TYPE_MISMATCH (Req 2.6)", () => {
    it("rejects a file whose type does not match the role and names the expected type", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/assets/background`)
        .attach("file", Buffer.from("<svg/>"), {
          filename: "bg.svg",
          contentType: "image/svg+xml",
        });
      expect(res.status).toBe(422);
      expectEnvelope(res.body, "TYPE_MISMATCH");
      expect(res.body.error.message).toMatch(/expects/i);
      expect(res.body.error.details).toMatchObject({ role: "background" });
    });
  });

  describe("PRECONDITION_FAILED (Req 3.5, 6.7, 9.5)", () => {
    it("rejects transcribe without a stored Audio_Asset (Req 3.5)", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/jobs`)
        .send({ type: "transcribe" });
      expect(res.status).toBe(409);
      expectEnvelope(res.body, "PRECONDITION_FAILED");
      expect(res.body.error.message).toMatch(/audio_asset is required/i);
      expect(res.body.error.details).toMatchObject({ projectId, type: "transcribe" });
    });

    it("rejects analyze without a stored Audio_Asset (Req 6.7)", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/jobs`)
        .send({ type: "analyze" });
      expect(res.status).toBe(409);
      expectEnvelope(res.body, "PRECONDITION_FAILED");
      expect(res.body.error.message).toMatch(/audio_asset is required/i);
      expect(res.body.error.details).toMatchObject({ projectId, type: "analyze" });
    });

    it("rejects render without a generated project-config.json (Req 9.5)", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/jobs`)
        .send({ type: "render" });
      expect(res.status).toBe(409);
      expectEnvelope(res.body, "PRECONDITION_FAILED");
      expect(res.body.error.message).toMatch(/configuration must be generated/i);
      expect(res.body.error.details).toMatchObject({
        projectId,
        type: "render",
        artifact: "project-config.json",
      });
    });

    it("enqueues once the precondition is satisfied (no precondition error)", async () => {
      await store.write({ projectId, relativePath: "assets/audio.mp3" }, Buffer.from("au"));
      const res = await request(app)
        .post(`/projects/${projectId}/jobs`)
        .send({ type: "transcribe" });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe("transcribe");
    });
  });

  describe("ARTIFACT_NOT_READY (Req 8.5, 11.4)", () => {
    it("rejects downloading a standardized artifact that has not been generated (Req 11.4)", async () => {
      const res = await request(app).get(`/projects/${projectId}/artifacts/lyrics.json`);
      expect(res.status).toBe(409);
      expectEnvelope(res.body, "ARTIFACT_NOT_READY");
      expect(res.body.error.message).toMatch(/not yet available/i);
      expect(res.body.error.details).toMatchObject({ projectId, artifact: "lyrics.json" });
    });

    it("rejects retrieving config before it is generated (Req 8.5)", async () => {
      const res = await request(app).get(`/projects/${projectId}/config`);
      expect(res.status).toBe(409);
      expectEnvelope(res.body, "ARTIFACT_NOT_READY");
      expect(res.body.error.message).toMatch(/configuration must be generated/i);
      expect(res.body.error.details).toMatchObject({
        projectId,
        artifact: "project-config.json",
      });
    });
  });

  describe("VALIDATION_ERROR for a malformed job request", () => {
    it("rejects an unrecognized job type with a 400 envelope", async () => {
      const res = await request(app)
        .post(`/projects/${projectId}/jobs`)
        .send({ type: "explode" });
      expect(res.status).toBe(400);
      expectEnvelope(res.body, "VALIDATION_ERROR");
      expect(res.body.error.message).toMatch(/transcribe, analyze, render/i);
    });
  });
});
