import type { AssetStore } from "../storage/index.js";

/**
 * Artifact catalog (`backend`, Req 11).
 *
 * Single source of truth for the standardized artifact file names a project can
 * produce, where each lives within a project scope, and the content type to
 * serve it with. The API_Service lists, downloads, and gates artifacts solely
 * through these helpers so the standardized-name contract (Req 11.3) is defined
 * in exactly one place and shared by the listing, download, and config routes.
 */

/** Prefix under which generated artifacts live within a project scope. */
export const ARTIFACTS_PREFIX = "artifacts/";

/**
 * The standardized artifact file names a project can produce (Req 11.1, 11.3),
 * in the order the design lists them: lyric data, raw transcription, analysis,
 * the assembled config, then the rendered videos.
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

const ARTIFACT_NAME_SET: ReadonlySet<string> = new Set(ARTIFACT_NAMES);

/** The standardized file name of the `Project_Config_Json` artifact (Req 8.1). */
export const CONFIG_ARTIFACT_NAME: ArtifactName = "project-config.json";

/** Narrow an arbitrary `:name` parameter to a known {@link ArtifactName}. */
export function isArtifactName(name: string): name is ArtifactName {
  return ARTIFACT_NAME_SET.has(name);
}

/** Resolve an artifact name to its project-relative storage path (Req 11.3). */
export function artifactRelativePath(name: ArtifactName): string {
  return `${ARTIFACTS_PREFIX}${name}`;
}

/** Content type to serve each artifact extension with on download (Req 11.2). */
const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".srt": "application/x-subrip",
  ".mp4": "video/mp4",
};

/**
 * Pick a sensible `Content-Type` for an artifact from its extension, defaulting
 * to `application/octet-stream` for anything unrecognized.
 */
export function artifactContentType(name: ArtifactName): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * List which standardized artifacts are currently present for a project
 * (Req 11.1). The result is exactly the subset of {@link ARTIFACT_NAMES} whose
 * file exists under `artifacts/`, preserving the catalog order. Files under
 * `artifacts/` that are not standardized names are ignored.
 */
export async function listPresentArtifacts(
  store: AssetStore,
  projectId: string,
): Promise<ArtifactName[]> {
  const stored = new Set(await store.list(projectId, ARTIFACTS_PREFIX));
  return ARTIFACT_NAMES.filter((name) => stored.has(artifactRelativePath(name)));
}
