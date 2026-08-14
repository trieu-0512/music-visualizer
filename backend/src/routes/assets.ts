import { Router } from "express";
import { validateLearningMap } from "@music-visualizer/shared";
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
 *   background, logos, audio, processed letters, and theme-first object assets by URL. This mirrors the
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
      if (role === "learningMap") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(file.buffer.toString("utf-8"));
        } catch (cause) {
          throw validationError("authoring/mapping.json is not valid JSON", {
            reason: cause instanceof Error ? cause.message : String(cause),
          });
        }
        const result = validateLearningMap(parsed);
        if (!result.ok) {
          throw validationError("authoring/mapping.json does not match the required schema", {
            errors: result.error,
          });
        }
      }
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

      res.type(assetContentType(relativePath));
      res.setHeader("Accept-Ranges", "bytes");

      const data = await store.read(ref);
      const rangeHeader = req.header("Range");
      if (rangeHeader !== undefined) {
        // Browsers use byte ranges for media seeking. The generic AssetStore
        // exposes streams but not file sizes, so the bytes are already loaded
        // here to calculate and validate the requested interval.
        const range = parseByteRange(rangeHeader, data.length);
        if (range === null) {
          res.status(416).setHeader("Content-Range", `bytes */${data.length}`).end();
          return;
        }

        const contentLength = range.end - range.start + 1;
        res
          .status(206)
          .setHeader("Content-Range", `bytes ${range.start}-${range.end}/${data.length}`)
          .setHeader("Content-Length", String(contentLength))
          .end(data.subarray(range.start, range.end + 1));
        return;
      }

      res.status(200).setHeader("Content-Length", String(data.length)).end(data);
    }),
  );

  return router;
}

interface ByteRange {
  start: number;
  end: number;
}

/** Parse one RFC 7233 byte range; multi-range requests are intentionally rejected. */
function parseByteRange(value: string, size: number): ByteRange | null {
  if (size <= 0 || !value.startsWith("bytes=") || value.includes(",")) return null;
  const spec = value.slice("bytes=".length).trim();
  const separator = spec.indexOf("-");
  if (separator < 0) return null;

  const startText = spec.slice(0, separator).trim();
  const endText = spec.slice(separator + 1).trim();
  let start: number;
  let end: number;

  if (startText === "") {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    if (!Number.isInteger(start) || start < 0 || start >= size) return null;
    end = endText === "" ? size - 1 : Number(endText);
    if (!Number.isInteger(end) || end < start) return null;
    end = Math.min(end, size - 1);
  }

  return { start, end };
}
