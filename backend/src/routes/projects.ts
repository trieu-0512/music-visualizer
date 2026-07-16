import { Router } from "express";
import { asyncHandler, notFound } from "../http/errors.js";
import { createMemoryUpload } from "../http/upload.js";
import type { ProjectService } from "../projects/index.js";
import { ImportFolderService } from "../projects/importFolder/index.js";
import type { JobQueue } from "../queue/JobQueue.js";
import type { AssetStore } from "../storage/index.js";

/**
 * Project routes (`backend`).
 *
 * - `POST /projects` — create a project (Req 1.1, 1.2).
 * - `GET /projects` — list project summaries (Architecture Upgrade PR-09).
 * - `GET /projects/:id` — project metadata + asset/artifact paths (Req 1.4).
 * - `GET /projects/:id/jobs` — jobs for a project (PR-09).
 * - `POST /projects/import-folder` — bulk folder import (PR-12 service).
 *
 * The router is mounted at the application root so its paths match the public
 * REST surface. Import logic lives in {@link ImportFolderService}.
 */
export function createProjectsRouter(
  service: ProjectService,
  store: AssetStore,
  jobQueue?: JobQueue,
): Router {
  const router = Router();
  const upload = createMemoryUpload({ preservePath: true });
  const importFolder = new ImportFolderService(service, store);

  router.post(
    "/projects/import-folder",
    upload.array("files"),
    asyncHandler(async (req, res) => {
      const uploadedFiles = (req.files ?? []) as Express.Multer.File[];
      const result = await importFolder.import(uploadedFiles, req.body);
      res.status(201).json(result);
    }),
  );

  router.post(
    "/projects",
    asyncHandler(async (req, res) => {
      const record = await service.create(req.body);
      res.status(201).json(record);
    }),
  );

  router.get(
    "/projects",
    asyncHandler(async (_req, res) => {
      const projects = await service.list();
      res.status(200).json({ projects });
    }),
  );

  router.get(
    "/projects/:id/jobs",
    asyncHandler(async (req, res) => {
      if (!jobQueue) {
        throw notFound("Job queue is not configured");
      }
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }
      const jobs = await jobQueue.listByProject(projectId);
      res.status(200).json({ jobs });
    }),
  );

  router.get(
    "/projects/:id",
    asyncHandler(async (req, res) => {
      const view = await service.getView(String(req.params.id));
      res.status(200).json(view);
    }),
  );

  return router;
}
