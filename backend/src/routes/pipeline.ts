import { Router } from "express";
import type { StartPipelineRequest } from "@music-visualizer/shared";
import { asyncHandler } from "../http/errors.js";
import type { PipelineRunService } from "../pipeline/index.js";

/** Persistent full-pipeline orchestration endpoints. */
export function createPipelineRouter(service: PipelineRunService): Router {
  const router = Router();

  router.post(
    "/projects/:id/pipeline",
    asyncHandler(async (req, res) => {
      const run = await service.start(
        String(req.params.id),
        (req.body ?? {}) as StartPipelineRequest,
      );
      res.status(201).json(run);
    }),
  );

  router.get(
    "/projects/:id/pipeline",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      await service.advance(projectId);
      res.status(200).json(await service.get(projectId));
    }),
  );

  return router;
}
