import { Router } from "express";
import { ApiError, asyncHandler, notFound } from "../http/errors.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";
import {
  artifactContentType,
  artifactRelativePath,
  isArtifactName,
  listPresentArtifacts,
} from "../artifacts/index.js";

/**
 * Artifact routes (`backend`, Req 11).
 *
 * - `GET /projects/:id/artifacts` — list the standardized artifacts currently
 *   present for the project (Req 11.1).
 * - `GET /projects/:id/artifacts/:name` — download a present artifact for the
 *   owning `Project_Id` (Req 11.2); when the artifact has not been generated
 *   yet the request is rejected with `ARTIFACT_NOT_READY` (Req 11.4).
 *
 * Both routes resolve an unknown `Project_Id` to a `NOT_FOUND` envelope
 * (Req 1.5) before doing any work, and the download route validates `:name`
 * against the standardized artifact set so only known names are addressable.
 * Bytes flow out of the Asset_Store as a stream; no filesystem path is
 * constructed by the route.
 */
export function createArtifactsRouter(service: ProjectService, store: AssetStore): Router {
  const router = Router();

  router.get(
    "/projects/:id/artifacts",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }
      const artifacts = await listPresentArtifacts(store, projectId);
      res.status(200).json({ projectId, artifacts });
    }),
  );

  router.get(
    "/projects/:id/artifacts/:name",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      const name = String(req.params.name);

      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      // Only standardized artifact names are addressable (Req 11.3).
      if (!isArtifactName(name)) {
        throw notFound(`Unknown artifact: ${name}`, { name });
      }

      const ref = { projectId, relativePath: artifactRelativePath(name) };
      if (!(await store.exists(ref))) {
        // Generated lazily by the worker/render pipeline; not yet available (Req 11.4).
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          `Artifact not yet available: ${name}`,
          { projectId, artifact: name },
        );
      }

      res.status(200).type(artifactContentType(name));
      const stream = await store.createReadStream(ref);
      stream.pipe(res);
      await new Promise<void>((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("error", reject);
      });
    }),
  );

  return router;
}
