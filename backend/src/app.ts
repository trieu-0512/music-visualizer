import express, { type Express } from "express";
import { loadConfig, type AppConfig } from "@music-visualizer/shared/config";
import { createAssetStore, type AssetStore } from "./storage/index.js";
import { createJobQueue, type JobQueue } from "./queue/JobQueue.js";
import { ProjectService } from "./projects/index.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createAssetsRouter } from "./routes/assets.js";
import { createArtifactsRouter } from "./routes/artifacts.js";
import { createConfigRouter } from "./routes/config.js";
import { createJobsRouter } from "./routes/jobs.js";
import { createPipelineRouter } from "./routes/pipeline.js";
import { PipelineRunService } from "./pipeline/index.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { loggingMiddleware } from "./http/logging.js";

/**
 * API_Service application factory.
 *
 * Reads the active storage and queue backends from configuration at startup
 * (Req 13.4), wires the Asset_Store and the project service, and mounts the
 * REST routes. Dependencies are injectable so routes can be exercised in
 * isolation (e.g. with supertest) and so later tasks can mount additional
 * routers (assets, jobs, config, artifacts) on the same app.
 */
export interface AppDependencies {
  config?: AppConfig;
  store?: AssetStore;
  projectService?: ProjectService;
  jobQueue?: JobQueue;
  pipelineRunService?: PipelineRunService;
}

/** Build the configured {@link Express} application ready to listen or test. */
export function createApp(deps: AppDependencies = {}): Express {
  const config = deps.config ?? loadConfig();
  const store = deps.store ?? createAssetStore(config.storage);
  const projectService = deps.projectService ?? new ProjectService(store);
  const jobQueue = deps.jobQueue ?? createJobQueue(config.queue);
  const pipelineRunService =
    deps.pipelineRunService ?? new PipelineRunService(projectService, store, jobQueue);

  const app = express();

  // Correlation id + JSON access logs (Architecture Upgrade PR-13).
  for (const mw of loggingMiddleware()) {
    app.use(mw);
  }

  app.use((req, res, next) => {
    const origin = req.header("Origin") ?? "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,x-request-id",
    );
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json());

  // Health check for boot/smoke verification (Req 14.5).
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(createProjectsRouter(projectService, store, jobQueue));
  app.use(createAssetsRouter(projectService, store));
  app.use(createArtifactsRouter(projectService, store));
  app.use(createConfigRouter(projectService, store));
  app.use(createJobsRouter(projectService, store, jobQueue));
  app.use(createPipelineRouter(pipelineRunService));

  // Unmatched routes and thrown ApiErrors flow through the uniform envelope.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { loadConfig };
