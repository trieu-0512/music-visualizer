import { Router } from "express";
import { ApiError, asyncHandler, notFound } from "../http/errors.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";

/** Storage location of the data contract shared by Remotion preview and render. */
const PREVIEW_DATA_PATH = "artifacts/preview-data.json";

/**
 * Remotion preview data route.
 *
 * Preview data is deliberately separate from the rendered MP4 artifacts: it
 * is needed while the project is still being authored. The browser receives
 * the same timeline/layout contract that the headless Remotion renderer uses.
 */
export function createPreviewRouter(service: ProjectService, store: AssetStore): Router {
  const router = Router();

  router.get(
    "/projects/:id/preview-data",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      const ref = { projectId, relativePath: PREVIEW_DATA_PATH };
      if (!(await store.exists(ref))) {
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          "Preview data has not been prepared for this project",
          { projectId, artifact: PREVIEW_DATA_PATH },
        );
      }

      let previewData: unknown;
      try {
        previewData = JSON.parse((await store.read(ref)).toString("utf8")) as unknown;
      } catch {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Preview data is not valid JSON",
          { projectId, artifact: PREVIEW_DATA_PATH },
        );
      }

      res.type("application/json").status(200).json(previewData);
    }),
  );

  return router;
}
