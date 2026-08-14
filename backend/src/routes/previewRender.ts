import { Router } from "express";
import { ApiError, asyncHandler, notFound, validationError } from "../http/errors.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";
import type {
  PreviewRenderJob,
  PreviewRenderOptions,
  PreviewRenderServiceApi,
} from "../preview/AbcPreviewRenderService.js";

const PREVIEW_DATA_PATH = "artifacts/preview-data.json";

/** API response adds a browser URL without exposing the local output path. */
type PreviewRenderResponse = Omit<PreviewRenderJob, "outputPath"> & {
  outputUrl?: string;
};

export function createPreviewRenderRouter(
  service: ProjectService,
  store: AssetStore,
  renderService: PreviewRenderServiceApi,
): Router {
  const router = Router();

  router.post(
    "/projects/:id/preview-render",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      await requireProject(service, projectId);
      if (!(await store.exists({ projectId, relativePath: PREVIEW_DATA_PATH }))) {
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          "Preview data has not been prepared for this project",
          { projectId, artifact: PREVIEW_DATA_PATH },
        );
      }
      if (renderService.getActive(projectId)) {
        throw new ApiError(
          "PRECONDITION_FAILED",
          "A preview render is already running for this project",
          { projectId },
        );
      }

      const options = parseOptions(req.body);
      const job = await renderService.start(projectId, options);
      res.status(202).json(toResponse(projectId, job, req.baseUrl));
    }),
  );

  router.get(
    "/projects/:id/preview-render/:jobId",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      await requireProject(service, projectId);
      const job = renderService.get(projectId, String(req.params.jobId));
      if (!job) throw notFound("Preview render job not found", { projectId });
      res.status(200).json(toResponse(projectId, job, req.baseUrl));
    }),
  );

  router.post(
    "/projects/:id/preview-render/:jobId/cancel",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      await requireProject(service, projectId);
      const job = await renderService.cancel(projectId, String(req.params.jobId));
      if (!job) throw notFound("Preview render job not found", { projectId });
      res.status(200).json(toResponse(projectId, job, req.baseUrl));
    }),
  );

  router.get(
    "/projects/:id/preview-render/:jobId/output",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      await requireProject(service, projectId);
      const job = renderService.get(projectId, String(req.params.jobId));
      if (!job) throw notFound("Preview render job not found", { projectId });
      if (job.status !== "completed") {
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          "The preview render has not completed",
          { projectId, jobId: job.id },
        );
      }
      const ref = { projectId, relativePath: job.outputPath };
      if (!(await store.exists(ref))) {
        throw new ApiError(
          "ARTIFACT_NOT_READY",
          "The preview render output is not available",
          { projectId, jobId: job.id },
        );
      }
      res.type("video/mp4");
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

async function requireProject(service: ProjectService, projectId: string): Promise<void> {
  if ((await service.get(projectId)) === null) {
    throw notFound(`Project not found: ${projectId}`, { projectId });
  }
}

function parseOptions(body: unknown): PreviewRenderOptions {
  if (body === null || typeof body !== "object") return {};
  const value = body as Record<string, unknown>;
  const options: PreviewRenderOptions = {};
  if (value.maxDurationSeconds !== undefined) {
    const seconds = number(value.maxDurationSeconds);
    if (seconds === null || seconds <= 0 || seconds > 86_400) {
      throw validationError("maxDurationSeconds must be between 1 and 86400 seconds");
    }
    options.maxDurationSeconds = seconds;
  }
  if (value.concurrency !== undefined) {
    const concurrency = number(value.concurrency);
    if (concurrency === null || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) {
      throw validationError("concurrency must be an integer between 1 and 64");
    }
    options.concurrency = concurrency;
  }
  if (value.resolution !== undefined) {
    if (value.resolution !== "fullhd" && value.resolution !== "4k") {
      throw validationError("resolution must be either fullhd or 4k");
    }
    options.resolution = value.resolution;
  }
  return options;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toResponse(
  projectId: string,
  job: PreviewRenderJob,
  baseUrl: string,
): PreviewRenderResponse {
  const { outputPath: _outputPath, ...publicJob } = job;
  return {
    ...publicJob,
    outputUrl: `${baseUrl}/projects/${encodeURIComponent(projectId)}/preview-render/${encodeURIComponent(job.id)}/output`,
  };
}
