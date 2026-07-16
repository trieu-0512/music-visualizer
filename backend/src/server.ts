import { loadConfig } from "@music-visualizer/shared/config";
import { createApp } from "./app.js";
import { createJobQueue } from "./queue/JobQueue.js";

/**
 * API_Service entry point.
 *
 * Boots the configured Express application (storage/queue backends selected
 * from configuration at startup, Req 13.4) and listens on `PORT` (default
 * 3000). Kept separate from the {@link createApp} factory so tests can mount
 * the app without binding a port.
 */
const PORT = Number(process.env.PORT ?? 3000);

const config = loadConfig();
const jobQueue = createJobQueue(config.queue);
// Boot orphan/full recover depending on queue.leaseRecoveryEnabled (PR-04b).
void jobQueue.recoverStale().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.warn("recoverStale on API boot failed:", err);
});

const app = createApp({ config, jobQueue });
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API_Service listening on http://localhost:${PORT}`);
});
