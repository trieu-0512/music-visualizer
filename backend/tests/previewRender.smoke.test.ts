import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  parseAbcProgressLine,
  recommendedConcurrencyFor,
  type PreviewRenderJob,
  type PreviewRenderServiceApi,
} from "../src/preview/AbcPreviewRenderService.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";

function makeJob(projectId: string, overrides: Partial<PreviewRenderJob> = {}): PreviewRenderJob {
  return {
    id: "render-1",
    projectId,
    status: "running",
    progress: 0.25,
    percent: 25,
    stage: "rendering",
    renderedFrames: 120,
    encodedFrames: 120,
    totalFrames: 480,
    elapsedMs: 4_000,
    etaMs: 12_000,
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:04.000Z",
    outputPath: "artifacts/abc-preview-sample-8s.mp4",
    ...overrides,
  };
}

describe("ABC preview render API", () => {
  let root: string;
  let store: AssetStore;
  let projectId: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-preview-render-"));
    store = new LocalAssetStore(root);
    const service = new ProjectService(store);
    const project = await service.create({
      songName: "Ocean Letter Splash",
      singerName: "ABC Kids Music",
      videoFormat: "landscape",
    });
    projectId = project.projectId;
    await store.write(
      { projectId, relativePath: "artifacts/preview-data.json" },
      Buffer.from(JSON.stringify({ metadata: {}, assets: {}, letters: {}, lines: [], layout: {} })),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("parses Remotion progress lines with percent and ETA", () => {
    expect(
      parseAbcProgressLine(
        'ABC_RENDER_PROGRESS {"stage":"rendering","progress":0.375,"percent":37.5,"renderedFrames":180,"encodedFrames":176,"totalFrames":480,"elapsedMs":4000,"etaMs":6667}',
      ),
    ).toEqual({
      stage: "rendering",
      progress: 0.375,
      percent: 37.5,
      renderedFrames: 180,
      encodedFrames: 176,
      totalFrames: 480,
      elapsedMs: 4000,
      etaMs: 6667,
    });
    expect(parseAbcProgressLine("ordinary log line")).toBeNull();
  });

  it("keeps the default renderer below the desktop saturation point", () => {
    expect(recommendedConcurrencyFor(16)).toBe(2);
    expect(recommendedConcurrencyFor(8)).toBe(2);
    expect(recommendedConcurrencyFor(4)).toBe(1);
    expect(recommendedConcurrencyFor(1)).toBe(1);
  });

  it("starts, reads, cancels, and serves a preview render job", async () => {
    let current = makeJob(projectId);
    const service: PreviewRenderServiceApi = {
      start: vi.fn(async () => current),
      getActive: vi.fn(() => null),
      get: vi.fn(() => current),
      cancel: vi.fn(async () => {
        current = { ...current, status: "cancelling" };
        return current;
      }),
    };
    const app = createApp({
      projectService: new ProjectService(store),
      store,
      previewRenderService: service,
    });

    const started = await request(app)
      .post(`/projects/${projectId}/preview-render`)
      .send({ maxDurationSeconds: 8, concurrency: 10 });
    expect(started.status).toBe(202);
    expect(started.body.id).toBe("render-1");
    expect(service.start).toHaveBeenCalledWith(projectId, {
      maxDurationSeconds: 8,
      concurrency: 10,
    });

    const status = await request(app).get(
      `/projects/${projectId}/preview-render/render-1`,
    );
    expect(status.status).toBe(200);
    expect(status.body.percent).toBe(25);
    expect(status.body.outputUrl).toContain(
      `/projects/${projectId}/preview-render/render-1/output`,
    );

    const cancelled = await request(app).post(
      `/projects/${projectId}/preview-render/render-1/cancel`,
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelling");
    expect(service.cancel).toHaveBeenCalledWith(projectId, "render-1");
  });

  it("rejects invalid render options before starting a child process", async () => {
    const service: PreviewRenderServiceApi = {
      start: vi.fn(),
      getActive: vi.fn(() => null),
      get: vi.fn(() => null),
      cancel: vi.fn(),
    };
    const app = createApp({
      projectService: new ProjectService(store),
      store,
      previewRenderService: service,
    });

    const response = await request(app)
      .post(`/projects/${projectId}/preview-render`)
      .send({ maxDurationSeconds: 0, concurrency: 101 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.start).not.toHaveBeenCalled();
  });
});
