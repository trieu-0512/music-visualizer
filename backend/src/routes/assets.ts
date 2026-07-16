import { Router } from "express";
import { asyncHandler, notFound, validationError } from "../http/errors.js";
import { createMemoryUpload } from "../http/upload.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";
import {
  assetContentType,
  computeReadiness,
  storeAsset,
  validateUpload,
  type UploadedFile,
} from "../assets/index.js";

/** Prefix under which uploaded assets live within a project scope. */
const ASSETS_PREFIX = "assets/";

/**
 * Asset routes (`backend`, Req 2, plus preview asset serving Req 8.x).
 *
 * - `POST /projects/:id/assets/:role` — upload or replace an asset for a role,
 *   validating the file type against `ROLE_RULES` and storing it under the
 *   owning `Project_Id` at its standardized path (Req 2.1–2.7).
 * - `GET /projects/:id/readiness` — report which required roles are present and
 *   which are missing (Req 2.8).
 * - `GET /projects/:id/assets/*` — stream a stored asset's bytes so the
 *   in-browser preview (Remotion Player) and a headless render can load the
 *   background, logos, audio, and the 26 letter SVGs by URL. This mirrors the
 *   artifact download route: bytes flow out of the Asset_Store as a stream,
 *   the content type is derived from the extension, and a missing asset
 *   resolves to a `NOT_FOUND` envelope.
 *
 * The serving route is registered after the readiness route so the literal
 * `readiness` path is never captured by the asset wildcard. All routes resolve
 * an unknown `Project_Id` to a `NOT_FOUND` envelope (Req 1.5) before doing any
 * work. Multipart bodies are parsed in memory by multer; the bytes flow to the
 * Asset_Store, never to a constructed path.
 */
export function createAssetsRouter(service: ProjectService, store: AssetStore): Router {
  const router = Router();
  // Buffer uploads in memory so the bytes can be handed straight to the
  // Asset_Store; hard size/count limits prevent unbounded RAM use (PR-07).
  const upload = createMemoryUpload({ files: 1 });

  router.post(
    "/projects/:id/assets/:role",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      const role = String(req.params.role);

      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      const uploaded = req.file;
      if (uploaded === undefined) {
        throw validationError("Expected a multipart file field named 'file'");
      }

      const file: UploadedFile = {
        originalName: uploaded.originalname,
        mimeType: uploaded.mimetype,
        buffer: uploaded.buffer,
      };
      validateUpload(role, file);
      const relativePath = await storeAsset(store, projectId, role, file);
      res.status(201).json({ projectId, role, path: relativePath });
    }),
  );

  router.get(
    "/projects/:id/readiness",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }
      res.status(200).json(await computeReadiness(store, projectId));
    }),
  );

  router.get(
    "/projects/:id/assets/*splat",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      // Reassemble the wildcard tail into the project-relative asset path
      // (e.g. "letters/T.svg" -> "assets/letters/T.svg"). Express 5 captures a
      // named wildcard as a string[] of path segments.
      const splat = (req.params as Record<string, unknown>).splat;
      const tail = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
      const relativePath = `${ASSETS_PREFIX}${tail}`;

      const ref = { projectId, relativePath };
      // The store guards against path traversal; surface a bad path as 404.
      let present: boolean;
      try {
        present = await store.exists(ref);
      } catch {
        throw notFound(`Asset not found: ${tail}`, { projectId, path: tail });
      }
      if (!present) {
        throw notFound(`Asset not found: ${tail}`, { projectId, path: tail });
      }

      res.status(200).type(assetContentType(relativePath));
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
