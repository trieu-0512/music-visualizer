import type { VideoFormat } from "@music-visualizer/shared";

/**
 * Project record (`backend`).
 *
 * The internal record persisted as `project.json` at the root of a project's
 * storage scope (design "Project Record (internal `project.json`)"). It holds
 * the assigned `Project_Id` plus the recorded `Project_Metadata` — song name,
 * singer name, and the requested `Video_Format` (Req 1.2) — and the creation
 * timestamp.
 */
export interface ProjectRecord {
  projectId: string;
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
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

/**
 * The public view returned for a project (Req 1.4): its metadata together with
 * the relative paths of every stored asset and every generated artifact.
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
