/**
 * Runnable render-worker entry point for the Render_Engine (deliverables task 13.1).
 *
 * This is the concrete wiring promised by the {@link runRenderWorker} doc note:
 * it constructs the **real** `FileJobQueue` and `LocalAssetStore` from the
 * startup configuration (Req 13.4) and drives the render claim loop. Both
 * concrete types satisfy the worker's structural `RenderJobQueue` /
 * `RenderAssetStore` seams, so no adapter is needed.
 *
 * Run it (from the workspace root) with the documented command:
 *
 * ```bash
 * npm run render-worker
 * ```
 *
 * which executes this module under the TypeScript runtime. The loop claims
 * `render` jobs enqueued via `POST /projects/:id/jobs` (type `render`), reads
 * each project's `project-config.json` through the store, renders the requested
 * MP4(s) with Remotion's headless Chromium + FFmpeg pipeline, and records the
 * outcome on the job (Req 9.1, 9.6). It runs forever until the process is
 * terminated by a signal.
 *
 * The composition entry point passed to {@link renderProject} is resolved to a
 * real file (the built `dist/index.js`, or the `src/index.ts` source when no
 * build is present) so the Remotion bundler can discover the registered
 * `landscape` / `portrait` compositions regardless of whether this module is
 * run from source or from the compiled output.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig } from "@music-visualizer/shared/config";
import { createJobQueue } from "@music-visualizer/backend/queue";
import { createAssetStore } from "@music-visualizer/backend/storage";

import { renderProject, type RenderAssetStore } from "./render.js";
import { runRenderWorker, type RenderJobQueue } from "./renderWorker.js";

/**
 * Resolve the Remotion composition entry (`registerRoot`) to a real file.
 *
 * Prefers the built `dist/index.js` (present after `npm run build`); falls back
 * to the `src/index.ts` source so the worker is runnable from source via the
 * TypeScript runtime before a build. The Remotion bundler accepts either a
 * compiled `.js` or a `.ts` entry.
 */
function resolveEntryPoint(): string {
  const candidates = [
    new URL("../dist/index.js", import.meta.url),
    new URL("./index.js", import.meta.url),
    new URL("./index.ts", import.meta.url),
  ].map((url) => fileURLToPath(url));
  return candidates.find((path) => existsSync(path)) ?? candidates[candidates.length - 1]!;
}

/**
 * Construct the concrete dependencies from startup config and run the render
 * worker loop. Exported so it can be invoked programmatically or in a test.
 */
export async function main(): Promise<void> {
  const config = loadConfig();
  // FileJobQueue / LocalAssetStore satisfy the worker's structural seams.
  const queue = createJobQueue(config.queue) as unknown as RenderJobQueue;
  const store = createAssetStore(config.storage) as unknown as RenderAssetStore;
  const entryPoint = resolveEntryPoint();

  // eslint-disable-next-line no-console
  console.log(
    `Render worker started (storage=${config.storage.backend}, queue=${config.queue.backend}); polling for render jobs...`,
  );

  await runRenderWorker(queue, store, {
    // Pin the composition entry so the bundler finds it from either src or dist.
    // Forward job-scoped deps (e.g. videoFormatOverride from params.format).
    renderProject: (cfg, st, deps) =>
      renderProject(cfg, st, { ...deps, entryPoint }),
  });
}

// Run when invoked directly (the documented `render-worker` script).
main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Render worker crashed:", err);
  process.exitCode = 1;
});
