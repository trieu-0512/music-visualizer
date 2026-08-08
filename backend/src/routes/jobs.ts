import { Router } from "express";
import { validateLearningMap, validateProjectConfig } from "@music-visualizer/shared";
import { ApiError, asyncHandler, notFound, validationError } from "../http/errors.js";
import type { ProjectService } from "../projects/index.js";
import type { AssetStore } from "../storage/index.js";
import type { JobQueue, JobType } from "../queue/JobQueue.js";
import { candidatePaths } from "../assets/index.js";
import { artifactRelativePath, CONFIG_ARTIFACT_NAME } from "../artifacts/index.js";
import { assertConfigFresh } from "../config/index.js";

/**
 * Job routes (`backend`, Req 3.1, 6.1, 9.1, 12.1, 12.2).
 *
 * - `POST /projects/:id/jobs` — enqueue a `transcribe`, `analyze`, or `render`
 *   job for the project (Req 3.1, 6.1, 9.1, 12.1). The request is gated by
 *   precondition checks before anything is enqueued:
 *   - `transcribe` / `analyze` require a stored `Audio_Asset`; absence is a
 *     `PRECONDITION_FAILED` envelope stating an `Audio_Asset` is required
 *     (Req 3.5, 6.7, 8.5 envelope semantics).
 *   - `render` requires a generated `project-config.json`; absence is a
 *     `PRECONDITION_FAILED` envelope stating configuration must be generated
 *     first (Req 9.5).
 * - `GET /jobs/:jobId` — return the job status (`pending` | `running` |
 *   `completed` | `failed`) and its details; an unknown id resolves to a
 *   `NOT_FOUND` envelope (Req 12.2).
 *
 * Job execution itself is performed by the Python Audio_Worker and the
 * Remotion render worker, which poll the Job_Queue; this router only enqueues
 * work and reports status. Unknown `Project_Id` values resolve to `NOT_FOUND`
 * (Req 1.5) before any precondition is evaluated.
 */
export function createJobsRouter(
  service: ProjectService,
  store: AssetStore,
  queue: JobQueue,
): Router {
  const router = Router();

  router.post(
    "/projects/:id/jobs",
    asyncHandler(async (req, res) => {
      const projectId = String(req.params.id);
      if ((await service.get(projectId)) === null) {
        throw notFound(`Project not found: ${projectId}`, { projectId });
      }

      const type = parseJobType(req.body);

      // Gate each job type on its inputs so a doomed job is never enqueued.
      if (type === "prepare-assets") {
        const mappingRef = { projectId, relativePath: "authoring/mapping.json" };
        if (!(await store.exists(mappingRef))) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            "canonical LOCKED authoring/mapping.json is required before preparing ABC assets",
            { projectId, type },
          );
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse((await store.read(mappingRef)).toString("utf-8"));
        } catch {
          throw new ApiError(
            "PRECONDITION_FAILED",
            "authoring/mapping.json must be valid JSON before preparing ABC assets",
            { projectId, type },
          );
        }
        const validation = validateLearningMap(parsed);
        if (!validation.ok) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            "authoring/mapping.json must be LOCKED and schema-valid before preparing ABC assets",
            { projectId, type, errors: validation.error },
          );
        }
      } else if (type === "transcribe" || type === "analyze") {
        if (!(await hasAudio(store, projectId))) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `An Audio_Asset is required before ${type === "transcribe" ? "transcription" : "analysis"}`,
            { projectId, type },
          );
        }
      } else {
        // render requires the assembled config (Req 9.5).
        const configRef = {
          projectId,
          relativePath: artifactRelativePath(CONFIG_ARTIFACT_NAME),
        };
        if (!(await store.exists(configRef))) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            "Configuration must be generated before rendering",
            { projectId, type, artifact: CONFIG_ARTIFACT_NAME },
          );
        }
      }

      if (type === "render") {
        await assertStoredConfigFresh(store, projectId);
      }

      const params = parseParams(req.body);
      if (type === "prepare-assets") validatePrepareAssetParams(params);
      const job = await queue.enqueue({ projectId, type, params });
      res.status(201).json(job);
    }),
  );

  router.get(
    "/jobs/:jobId",
    asyncHandler(async (req, res) => {
      const jobId = String(req.params.jobId);
      const job = await queue.get(jobId);
      if (job === null) {
        throw notFound(`Job not found: ${jobId}`, { jobId });
      }
      res.status(200).json(job);
    }),
  );

  return router;
}

/** Accepted job types a client may request (Req 3.1, 6.1, 9.1). */
const JOB_TYPES = new Set<JobType>(["prepare-assets", "transcribe", "analyze", "render"]);

/**
 * Read and validate the requested job `type` from the request body, rejecting a
 * missing or unrecognized value with a `VALIDATION_ERROR` envelope.
 */
function parseJobType(body: unknown): JobType {
  const type = (body as { type?: unknown } | null)?.type;
  if (typeof type !== "string" || !JOB_TYPES.has(type as JobType)) {
    throw validationError("Job type must be one of: prepare-assets, transcribe, analyze, render", {
      type: type ?? null,
    });
  }
  return type as JobType;
}

/** Pass through caller-supplied job params (e.g. `{ format: "both" }`), or `{}`. */
function validatePrepareAssetParams(params: Record<string, unknown>): void {
  if (params.target !== undefined) {
    const target = String(params.target).trim().toUpperCase();
    if (!/^[A-Z]$/.test(target)) {
      throw validationError("prepare-assets params.target must be one A-Z letter", { target: params.target });
    }
    params.target = target;
  }
  if (params.force !== undefined && typeof params.force !== "boolean") {
    throw validationError("prepare-assets params.force must be boolean", { force: params.force });
  }
}

function parseParams(body: unknown): Record<string, unknown> {
  const params = (body as { params?: unknown } | null)?.params;
  if (params !== null && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  return {};
}

async function assertStoredConfigFresh(store: AssetStore, projectId: string): Promise<void> {
  const ref = {
    projectId,
    relativePath: artifactRelativePath(CONFIG_ARTIFACT_NAME),
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse((await store.read(ref)).toString("utf-8"));
  } catch {
    throw new ApiError(
      "PRECONDITION_FAILED",
      "Configuration is invalid; rebuild config before rendering",
      { projectId, artifact: CONFIG_ARTIFACT_NAME },
    );
  }
  const validation = validateProjectConfig(parsed);
  if (!validation.ok) {
    throw new ApiError(
      "PRECONDITION_FAILED",
      "Configuration is invalid; rebuild config before rendering",
      { projectId, artifact: CONFIG_ARTIFACT_NAME, errors: validation.error },
    );
  }
  await assertConfigFresh(store, projectId, validation.value);
}

/** True when any accepted `Audio_Asset` path is stored for the project. */
async function hasAudio(store: AssetStore, projectId: string): Promise<boolean> {
  for (const relativePath of candidatePaths("audio")) {
    if (await store.exists({ projectId, relativePath })) return true;
  }
  return false;
}
