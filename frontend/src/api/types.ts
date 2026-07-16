/**
 * Web_App API client types (`frontend`).
 *
 * Request/response shapes for the API_Service REST surface, mirrored from the
 * backend route handlers so the Web_App consumes the API in a fully typed way.
 * Artifact schema types (`ProjectConfigJson`, `VideoFormat`, …) are re-exported
 * from `@music-visualizer/shared` so there is one source of truth (Req 15.4);
 * the transport-level shapes (project record/view, readiness, job, artifact
 * listing, error envelope) are declared here to match the API responses.
 */

import type {
  VideoFormat,
  ProjectConfigJson,
  LyricsJson,
  AudioAnalysisJson,
} from "@music-visualizer/shared";

export type { VideoFormat, ProjectConfigJson, LyricsJson, AudioAnalysisJson };

/**
 * The `Project_Metadata` supplied when creating a project: song name, singer
 * name, and requested `Video_Format` (Req 1.2).
 */
export interface ProjectMetadata {
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
}

/** Response of `POST /projects` — the created project record (Req 1.1, 1.2). */
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

/** Response of `POST /projects/:id/assets/:role` (Req 2.1–2.7). */
export interface AssetUploadResult {
  projectId: string;
  role: string;
  /** Standardized relative path the asset was stored at. */
  path: string;
}

/** Response of `GET /projects/:id/readiness` (Req 2.8). */
export interface ReadinessReport {
  projectId: string;
  /** True when every required role has a stored file. */
  ready: boolean;
  /** Required roles that have a stored file. */
  present: string[];
  /** Required roles with no stored file. */
  missing: string[];
}

/** Job types a client may request (Req 3.1, 6.1, 9.1). */
export type JobType = "transcribe" | "analyze" | "render";

/** Lifecycle status of a job (Req 12.2). */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/**
 * A processing/render job as returned by `POST /projects/:id/jobs` and
 * `GET /jobs/:jobId` (Req 12.1–12.4).
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
}

/**
 * The standardized artifact file names a project can produce (Req 11.1, 11.3),
 * matching the backend Artifact_Catalog.
 */
export const ARTIFACT_NAMES = [
  "lyrics.json",
  "lyrics.srt",
  "whisperx.json",
  "audio-analysis.json",
  "project-config.json",
  "final-16x9-fullhd-60fps.mp4",
  "final-9x16-fullhd-60fps.mp4",
  "final-16x9-2k-60fps.mp4",
  "final-9x16-2k-60fps.mp4",
  "final-16x9-4k-60fps.mp4",
  "final-9x16-4k-60fps.mp4",
] as const;

/** One of the standardized artifact file names. */
export type ArtifactName = (typeof ARTIFACT_NAMES)[number];

/** Response of `GET /projects/:id/artifacts` (Req 11.1). */
export interface ArtifactList {
  projectId: string;
  /** The subset of standardized artifact names currently present. */
  artifacts: ArtifactName[];
}

/** Response of `POST /projects/import-folder`. */
export interface FolderImportResult {
  project: ProjectRecord;
  readiness: ReadinessReport;
  config: ProjectConfigJson | null;
  artifacts: ArtifactName[];
}

/** The documented API error codes (design "API Error Envelope"). */
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
