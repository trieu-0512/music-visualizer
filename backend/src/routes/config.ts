import { Router } from "express";
import { ApiError, asyncHandler, notFound } from "../http/errors.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";
import { buildConfig } from "../config/index.js";
import { artifactRelativePath, CONFIG_ARTIFACT_NAME } from "../artifacts/index.js";

/**
 * Config routes (`backend`, Req 7.1, 7.7, 8.1, 8.5).
 *
 * - `POST /projects/:id/config` — build the `Project_Config_Json` for the
 *   project via the Config_Builder and return the assembled config (Req 7.1).
 *   When a required asset or artifact is missing the request is rejected with
 *   the `MISSING_REQUIREMENTS` envelope listing every missing item (Req 7.7).
 *   This is the runnable config-generation step the preview and render stages
 *   depend on (design Processing Pipeline "Generate config").
 * - `GET /projects/:id/config` — return the already-built config so the Web_App
 *   can drive a preview (Req 8.1). When no config has been generated the
 *   request is rejected with `ARTIFACT_NOT_READY` so the Web_App can show the
 *   "configuration must be generated before preview" message (Req 8.5),
 *   consistent with how artifact downloads report a not-yet-generated artifact
 *   (Req 11.4). `project-config.json` is the artifact written by the
 *   Config_Builder (task 4.1).
 *
 * Unknown `Project_Id` values resolve to a `NOT_FOUND` envelope first (Req 1.5).
 */
export function createConfigRouter(service: ProjectService, store: AssetStore): Router {
  const router = Router();

  router.post(
    "/projects/:id/config",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      const project = await service.get(projectId);
      if (project === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      // Assemble + persist project-config.json, or reject listing each missing
      // required asset/artifact (Req 7.1, 7.7). The error carries the documented
      // MISSING_REQUIREMENTS envelope; rethrow it through the error pipeline.
      const result = await buildConfig(projectId, store, project);
      if (!result.ok) {
        throw result.error;
      }
      res.status(201).json(result.value);
    }),
  );

  router.get(
    "/projects/:id/config",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      const ref = { projectId, relativePath: artifactRelativePath(CONFIG_ARTIFACT_NAME) };
      if (!(await store.exists(ref))) {
        // Preview requires a config; signal that one must be generated first (Req 8.5).
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          "Configuration must be generated before preview",
          { projectId, artifact: CONFIG_ARTIFACT_NAME },
        );
      }

      const raw = await store.read(ref);
      res.status(200).type("application/json").send(raw.toString("utf-8"));
    }),
  );

  return router;
}
