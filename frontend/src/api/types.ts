/**
 * Web_App API client types (`frontend`).
 *
 * Request/response shapes for the API_Service REST surface. Artifact schema
 * types and core transport DTOs (`Job`, `ProjectRecord`, `ApiErrorCode`, …) are
 * re-exported from `@music-visualizer/shared` so there is one source of truth
 * (Req 15.4 / Architecture Upgrade PR-08). Frontend-only constants and a few
 * response wrappers remain here.
 */

import type {
  VideoFormat,
  ProjectConfigJson,
  LyricsJson,
  AudioAnalysisJson,
  Job,
  JobType,
  JobStatus,
  ApiErrorCode,
  ApiErrorEnvelope,
  ProjectMetadata,
  ProjectRecord,
  ProjectView,
  ProjectList,
  ProjectJobList,
  PipelineRun,
  PipelineRunStatus,
  PipelineRunStep,
  StartPipelineRequest,
} from "@music-visualizer/shared";

export type {
  VideoFormat,
  ProjectConfigJson,
  LyricsJson,
  AudioAnalysisJson,
  Job,
  JobType,
  JobStatus,
  ApiErrorCode,
  ApiErrorEnvelope,
  ProjectMetadata,
  ProjectRecord,
  ProjectView,
  ProjectList,
  ProjectJobList,
  PipelineRun,
  PipelineRunStatus,
  PipelineRunStep,
  StartPipelineRequest,
};

/** Response of `POST /projects/:id/assets/:role` (Req 2.1–2.7). */
export interface AssetUploadResult {
  projectId: string;
  role: string;
  /** Standardized relative path the asset was stored at. */
  path: string;
}

/** Response of `GET /projects/:id/readiness` (Req 2.8). */
export type ReadinessStage = "ready" | "blocked" | "not-applicable";

export interface ReadinessReport {
  projectId: string;
  /** True when every required role has a stored file. */
  ready: boolean;
  /** Required roles that have a stored file. */
  present: string[];
  /** Required roles with no stored file. */
  missing: string[];
  stages?: {
    prepareAssets: ReadinessStage;
    transcribe: ReadinessStage;
    analyze: ReadinessStage;
    buildConfig: ReadinessStage;
    render: ReadinessStage;
  };
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
  "asset-prep-report.json",
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

/** Live status returned by the Remotion ABC preview render controller. */
export type PreviewRenderStatus =
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export interface PreviewRenderOptions {
  maxDurationSeconds?: number;
  concurrency?: number;
  resolution?: "fullhd" | "4k";
}

export interface PreviewRenderJob {
  id: string;
  projectId: string;
  status: PreviewRenderStatus;
  progress: number;
  percent: number;
  stage: string;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number | null;
  elapsedMs: number;
  etaMs: number;
  createdAt: string;
  updatedAt: string;
  outputUrl: string;
  maxDurationSeconds?: number;
  error?: string;
}

/** Response of `POST /projects/import-folder`. */
export interface FolderImportResult {
  project: ProjectRecord;
  readiness: ReadinessReport;
  config: ProjectConfigJson | null;
  artifacts: ArtifactName[];
}
