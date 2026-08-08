/**
 * Unit tests for the render worker claim loop (task 10.6).
 *
 * These cover the Chromium-free orchestration: claiming a `render` job,
 * loading + validating its `project-config.json`, invoking an injected
 * `renderProject`, and recording the outcome on the job. A fake queue (returns
 * one render job then `null`), a fake in-memory store, and a fake
 * `renderProject` are injected so no browser is launched and `renderProject`'s
 * real pipeline is never exercised here.
 */
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import type { ProjectConfigJson } from "@music-visualizer/shared";
import type { AssetRef, RenderAssetStore } from "../src/render.js";
import {
  CONFIG_RELATIVE_PATH,
  processRenderJob,
  runRenderWorker,
  type RenderJob,
  type RenderJobQueue,
  type RenderProjectFn,
} from "../src/renderWorker.js";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** A valid `project-config.json` the worker can read + validate. */
function makeConfig(
  projectId = "p_test",
  videoFormat: ProjectConfigJson["videoFormat"] = "landscape",
): ProjectConfigJson {
  return {
    version: 1,
    projectId,
    metadata: { songName: "Song", singerName: "Singer" },
    videoFormat,
    assets: {
      background: "assets/background.jpg",
      songLogo: "assets/song-logo.png",
      channelLogo: "assets/channel-logo.png",
      audio: "assets/audio.mp3",
      letters: Object.fromEntries(
        LETTERS.map((l) => [l, `assets/letters/${l}.svg`]),
      ),
    },
    artifacts: {
      lyrics: "artifacts/lyrics.json",
      audioAnalysis: "artifacts/audio-analysis.json",
    },
    layout: {
      template: "classic-landscape",
      lyricBox: { maxLines: 2 },
      bars: { left: true, right: true },
    },
  };
}

/**
 * In-memory {@link RenderAssetStore}. Seed with `projectId/relativePath -> bytes`
 * entries; `read` throws for missing keys (mirroring the real store).
 */
function makeStore(seed: Record<string, Buffer> = {}): RenderAssetStore & {
  files: Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>(Object.entries(seed));
  const key = (ref: AssetRef) => `${ref.projectId}/${ref.relativePath}`;
  return {
    files,
    async read(ref) {
      const value = files.get(key(ref));
      if (!value) throw new Error(`not found: ${key(ref)}`);
      return value;
    },
    async write(ref, data) {
      files.set(key(ref), data);
    },
    async delete(ref) {
      files.delete(key(ref));
    },
    async exists(ref) {
      return files.has(key(ref));
    },
  };
}

/** Seed a store with a project's valid config at the standardized path. */
function storeWithConfig(config: ProjectConfigJson): RenderAssetStore & {
  files: Map<string, Buffer>;
} {
  return makeStore({
    [`${config.projectId}/${CONFIG_RELATIVE_PATH}`]: Buffer.from(
      JSON.stringify(config),
    ),
  });
}

/**
 * Fake {@link RenderJobQueue} that hands out the given jobs in order (one per
 * `claimNext`) then `null`, and records `markCompleted`/`markFailed` calls.
 */
function makeQueue(jobs: RenderJob[]): RenderJobQueue & {
  completed: { id: string; artifacts: string[] }[];
  failed: { id: string; error: string }[];
  claims: number;
} {
  const queue = [...jobs];
  const completed: { id: string; artifacts: string[] }[] = [];
  const failed: { id: string; error: string }[] = [];
  return {
    completed,
    failed,
    claims: 0,
    async claimNext(_types, opts) {
      this.claims += 1;
      const next = queue.shift() ?? null;
      if (next === null) return null;
      return {
        ...next,
        claimedBy: next.claimedBy ?? opts.workerId,
        claimGeneration: next.claimGeneration ?? 0,
      };
    },
    async markCompleted(jobId, artifacts, _opts) {
      completed.push({ id: jobId, artifacts });
      return undefined;
    },
    async markFailed(jobId, error, _opts) {
      failed.push({ id: jobId, error });
      return undefined;
    },
  };
}

function renderJob(
  projectId = "p_test",
  paramsOrId: Record<string, unknown> | string = {},
  id = "job_1",
): RenderJob {
  // Overload: renderJob(projectId, jobId) still works for multi-job tests.
  if (typeof paramsOrId === "string") {
    return {
      id: paramsOrId,
      projectId,
      type: "render",
      params: {},
      claimedBy: "test-worker",
      claimGeneration: 0,
    };
  }
  return {
    id,
    projectId,
    type: "render",
    params: paramsOrId,
    claimedBy: "test-worker",
    claimGeneration: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* processRenderJob (Req 9.1, 9.6)                                            */
/* -------------------------------------------------------------------------- */

describe("processRenderJob", () => {
  it("renders a claimed job and marks it completed with produced artifacts (Req 9.1)", async () => {
    const config = makeConfig("p_test", "both");
    const store = storeWithConfig(config);
    const job = renderJob("p_test");
    const queue = makeQueue([]);

    const produced = [
      "artifacts/final-16x9-fullhd-60fps.mp4",
      "artifacts/final-9x16-fullhd-60fps.mp4",
    ];
    const render: RenderProjectFn = vi.fn(async (cfg, s) => {
      // The validated config and the same store are passed through.
      expect(cfg.projectId).toBe("p_test");
      expect(s).toBe(store);
      return produced;
    });

    await processRenderJob(job, queue, store, { renderProject: render, heartbeatIntervalMs: 0 });

    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(config, store, {});
    expect(queue.completed).toEqual([{ id: "job_1", artifacts: produced }]);
    expect(queue.failed).toEqual([]);
  });

  it("forwards params.format as videoFormatOverride to renderProject (KD-6)", async () => {
    const config = makeConfig("p_test", "both");
    const store = storeWithConfig(config);
    const job = renderJob("p_test", { format: "landscape" });
    const queue = makeQueue([]);
    const render: RenderProjectFn = vi.fn(async () => ["artifacts/final-16x9-fullhd-60fps.mp4"]);

    await processRenderJob(job, queue, store, { renderProject: render, heartbeatIntervalMs: 0 });

    expect(render).toHaveBeenCalledWith(config, store, {
      videoFormatOverride: "landscape",
    });
    expect(queue.completed).toHaveLength(1);
  });

  it("marks the job failed with the renderProject error message (Req 9.6)", async () => {
    const config = makeConfig("p_test");
    const store = storeWithConfig(config);
    const job = renderJob("p_test");
    const queue = makeQueue([]);

    const render: RenderProjectFn = vi.fn(async () => {
      throw new Error("chromium crashed");
    });

    await processRenderJob(job, queue, store, { renderProject: render, heartbeatIntervalMs: 0 });

    expect(queue.completed).toEqual([]);
    expect(queue.failed).toEqual([{ id: "job_1", error: "chromium crashed" }]);
  });

  it("marks the job failed when the config is missing, without calling renderProject (Req 9.6)", async () => {
    const store = makeStore(); // no config seeded
    const job = renderJob("p_missing");
    const queue = makeQueue([]);
    const render: RenderProjectFn = vi.fn(async () => []);

    await processRenderJob(job, queue, store, { renderProject: render, heartbeatIntervalMs: 0 });

    expect(render).not.toHaveBeenCalled();
    expect(queue.completed).toEqual([]);
    expect(queue.failed).toHaveLength(1);
    expect(queue.failed[0]?.id).toBe("job_1");
    expect(queue.failed[0]?.error).toMatch(/project-config\.json/);
  });

  it("rejects a stale config dependency before invoking renderProject", async () => {
    const config: ProjectConfigJson = {
      ...makeConfig("p_test"),
      provenance: {
        builtAt: "2026-08-08T00:00:00.000Z",
        dependencies: { "assets/audio.mp3": "0".repeat(64) },
      },
    };
    const store = storeWithConfig(config);
    store.files.set("p_test/assets/audio.mp3", Buffer.from("changed-audio"));
    const queue = makeQueue([]);
    const render: RenderProjectFn = vi.fn(async () => []);

    await processRenderJob(
      renderJob("p_test"),
      queue,
      store,
      { renderProject: render, heartbeatIntervalMs: 0 },
    );

    expect(render).not.toHaveBeenCalled();
    expect(queue.completed).toEqual([]);
    expect(queue.failed[0]?.error).toMatch(/stale/i);
    expect(queue.failed[0]?.error).toContain("assets/audio.mp3");
  });

  it("marks the job failed when the config is invalid, without calling renderProject (Req 9.6)", async () => {
    const store = makeStore({
      [`p_test/${CONFIG_RELATIVE_PATH}`]: Buffer.from(
        JSON.stringify({ version: 1, projectId: "p_test" }), // missing required fields
      ),
    });
    const job = renderJob("p_test");
    const queue = makeQueue([]);
    const render: RenderProjectFn = vi.fn(async () => []);

    await processRenderJob(job, queue, store, { renderProject: render, heartbeatIntervalMs: 0 });

    expect(render).not.toHaveBeenCalled();
    expect(queue.failed).toHaveLength(1);
    expect(queue.failed[0]?.error).toMatch(/valid project config/);
  });
});

/* -------------------------------------------------------------------------- */
/* runRenderWorker (Req 9.1, 9.6)                                             */
/* -------------------------------------------------------------------------- */

describe("runRenderWorker", () => {
  it("claims a render job, processes it, and stops via the stop predicate", async () => {
    const config = makeConfig("p_test");
    const store = storeWithConfig(config);
    const queue = makeQueue([renderJob("p_test")]);

    const render: RenderProjectFn = vi.fn(async () => [
      "artifacts/final-16x9-fullhd-60fps.mp4",
    ]);

    // Stop once the single job has been recorded as completed/failed.
    const stop = () => queue.completed.length + queue.failed.length > 0;

    await runRenderWorker(queue, store, {
      renderProject: render,
      pollIntervalMs: 0,
      heartbeatIntervalMs: 0,
      stop,
    });

    expect(render).toHaveBeenCalledTimes(1);
    expect(queue.completed).toEqual([
      { id: "job_1", artifacts: ["artifacts/final-16x9-fullhd-60fps.mp4"] },
    ]);
  });

  it("claims only `render` job types", async () => {
    const config = makeConfig("p_test");
    const store = storeWithConfig(config);
    const queue = makeQueue([renderJob("p_test")]);
    const claimedTypes: string[][] = [];
    const originalClaim = queue.claimNext.bind(queue);
    queue.claimNext = async (types, opts) => {
      claimedTypes.push(types);
      return originalClaim(types, opts);
    };

    const stop = () => queue.completed.length > 0;
    await runRenderWorker(queue, store, {
      renderProject: vi.fn(async () => []),
      pollIntervalMs: 0,
      heartbeatIntervalMs: 0,
      stop,
    });

    expect(claimedTypes[0]).toEqual(["render"]);
  });

  it("sleeps and re-polls when no job is claimable, then stops", async () => {
    const store = makeStore();
    const queue = makeQueue([]); // always returns null
    const render: RenderProjectFn = vi.fn(async () => []);
    const sleep = vi.fn(async () => undefined);

    // Stop after a couple of empty polls so the loop terminates deterministically.
    let polls = 0;
    const stop = () => {
      polls += 1;
      return polls > 3;
    };

    await runRenderWorker(queue, store, {
      renderProject: render,
      pollIntervalMs: 5,
      stop,
      sleep,
    });

    expect(render).not.toHaveBeenCalled();
    expect(queue.completed).toEqual([]);
    expect(queue.failed).toEqual([]);
    // It polled the empty queue at least once and slept between polls.
    expect(queue.claims).toBeGreaterThan(0);
    expect(sleep).toHaveBeenCalledWith(5);
  });

  it("returns immediately when stop is true on entry (no claim)", async () => {
    const store = makeStore();
    const queue = makeQueue([renderJob("p_test")]);

    await runRenderWorker(queue, store, {
      renderProject: vi.fn(async () => []),
      pollIntervalMs: 0,
      stop: () => true,
    });

    expect(queue.claims).toBe(0);
    expect(queue.completed).toEqual([]);
    expect(queue.failed).toEqual([]);
  });

  it("processes multiple jobs in sequence until the queue drains", async () => {
    const configA = makeConfig("pa");
    const configB = makeConfig("pb");
    const store = makeStore({
      [`pa/${CONFIG_RELATIVE_PATH}`]: Buffer.from(JSON.stringify(configA)),
      [`pb/${CONFIG_RELATIVE_PATH}`]: Buffer.from(JSON.stringify(configB)),
    });
    const queue = makeQueue([
      renderJob("pa", "job_a"),
      renderJob("pb", "job_b"),
    ]);

    const render: RenderProjectFn = vi.fn(async (cfg) => [
      `artifacts/${cfg.projectId}.mp4`,
    ]);

    // Stop once both jobs have terminal records.
    const stop = () => queue.completed.length + queue.failed.length >= 2;

    await runRenderWorker(queue, store, {
      renderProject: render,
      pollIntervalMs: 0,
      heartbeatIntervalMs: 0,
      stop,
    });

    expect(render).toHaveBeenCalledTimes(2);
    expect(queue.completed).toEqual([
      { id: "job_a", artifacts: ["artifacts/pa.mp4"] },
      { id: "job_b", artifacts: ["artifacts/pb.mp4"] },
    ]);
  });
});
