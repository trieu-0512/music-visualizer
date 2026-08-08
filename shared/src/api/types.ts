/**
 * Shared API transport types (Architecture Upgrade PR-08 / KD-8).
 *
 * Single source of truth for REST DTOs and error codes consumed by the backend
 * queue, Express routes, and the Web_App client. Artifact schemas stay under
 * `shared/src/schema` and `shared/src/types`.
 */

import type { VideoFormat } from "../types/projectConfig.js";

/** Job types a client may request (Req 3.1, 6.1, 9.1). */
export type JobType = "prepare-assets" | "transcribe" | "analyze" | "render";

/** Lifecycle status of a job (Req 12.2). */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/**
 * A processing/render job as returned by job enqueue/status endpoints
 * (Req 12.1–12.4). Claim/lease fields are optional and present only while a
 * worker owns a running job (Architecture Upgrade PR-04).
 */
export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  /** e.g. `{ format: "both" }` for a render job. */
  params: Record<string, unknown>;
  /** relativePaths produced (recorded on completion). */
  artifacts: string[];
  /** failure message (recorded on failure). */
  error?: string;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string;
  heartbeatAt?: string;
  claimedBy?: string;
  claimGeneration?: number;
  requeueCount?: number;
}

/** Documented API error codes (design "API Error Envelope"). */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNSUPPORTED_FORMAT"
  | "TYPE_MISMATCH"
  | "PRECONDITION_FAILED"
  | "MISSING_REQUIREMENTS"
  | "ARTIFACT_NOT_READY"
  | "INTERNAL_ERROR";

/** The uniform error envelope returned by the API on any failure. */
export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * The `Project_Metadata` supplied when creating a project: song name, singer
 * name, and requested `Video_Format` (Req 1.2).
 */
export interface ProjectMetadata {
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
}

/** Response of `POST /projects` / project summary in `GET /projects`. */
export interface ProjectRecord {
  projectId: string;
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/**
 * Response of `GET /projects/:id` — project metadata plus the relative paths of
 * every stored asset and generated artifact (Req 1.4).
 */
export interface ProjectView {
  projectId: string;
  metadata: ProjectMetadata;
  createdAt: string;
  /** Relative paths of stored assets (under `assets/`). */
  assets: string[];
  /** Relative paths of generated artifacts (under `artifacts/`). */
  artifacts: string[];
}

/** Response of `GET /projects` (Architecture Upgrade PR-09). */
export interface ProjectList {
  projects: ProjectRecord[];
}

/** Response of `GET /projects/:id/jobs` (Architecture Upgrade PR-09). */
export interface ProjectJobList {
  jobs: Job[];
}
