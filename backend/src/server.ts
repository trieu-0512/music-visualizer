import { loadConfig } from "@music-visualizer/shared/config";
import { createApp } from "./app.js";
import { PipelineRunService, startPipelineSupervisor } from "./pipeline/index.js";
import { ProjectService } from "./projects/index.js";
import { createJobQueue } from "./queue/JobQueue.js";
import { createAssetStore } from "./storage/index.js";

/**
 * API_Service entry point.
 *
 * The API owns persistent pipeline orchestration while audio/render workers own
 * child-job execution. This means closing the browser does not stop a full run;
 * the supervisor resumes stored PipelineRun state after API restart.
 */
const PORT = Number(process.env.PORT ?? 3000);

const config = loadConfig();
const store = createAssetStore(config.storage);
const projectService = new ProjectService(store);
const jobQueue = createJobQueue(config.queue);
const pipelineRunService = new PipelineRunService(projectService, store, jobQueue);

// Boot orphan/full recover depending on queue.leaseRecoveryEnabled (PR-04b).
void jobQueue.recoverStale().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.warn("recoverStale on API boot failed:", err);
});

startPipelineSupervisor(pipelineRunService);

const app = createApp({
  config,
  store,
  projectService,
  jobQueue,
  pipelineRunService,
});
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API_Service listening on http://localhost:${PORT}`);
});
