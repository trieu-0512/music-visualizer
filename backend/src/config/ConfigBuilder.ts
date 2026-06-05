import { Buffer } from "node:buffer";
import type {
  AssetPaths,
  LayoutDefinition,
  ProjectConfigJson,
  Result,
  VideoFormat,
} from "@music-visualizer/shared";
import { err, ok } from "@music-visualizer/shared";
import type { AssetRef, AssetStore } from "../storage/index.js";
import type { ProjectRecord } from "../projects/index.js";
import { ApiError } from "../http/errors.js";

/**
 * Config_Builder (`backend`).
 *
 * Assembles the authoritative `project-config.json` artifact for a project from
 * the stored asset paths, the lyric/analysis artifact paths, the requested
 * `Video_Format`, the selected layout/template, and the project metadata
 * (Req 7.1–7.6). When any required asset or artifact is absent, generation is
 * rejected with a single `MISSING_REQUIREMENTS` error that lists every missing
 * item (Req 7.7).
 *
 * Assets are referenced by path so the background, the A–Z letters, and the
 * lyric artifacts can later be swapped by replacing files alone, with no code
 * change (Req 15.2).
 */

/**
 * Required single-instance asset roles (Req 7.2). Each maps to a standardized
 * file stem stored directly under `assets/` by the asset upload handler
 * (task 3.3 / design Storage Layout). The on-disk extension varies by uploaded
 * file (e.g. `background.png` vs `background.jpg`), so paths are resolved from
 * the actual listing rather than assuming an extension — see
 * {@link indexTopLevelAssets}.
 */
const REQUIRED_ASSETS = ["background", "songLogo", "channelLogo", "audio"] as const;

/** Storage file stem (under `assets/`) for each required asset role. */
const ASSET_FILE_STEMS: Record<(typeof REQUIRED_ASSETS)[number], string> = {
  background: "background",
  songLogo: "song-logo",
  channelLogo: "channel-logo",
  audio: "audio",
};

/** The 26 `Letter_Asset` keys A–Z that must each be present (Req 7.2). */
const REQUIRED_LETTERS: string[] = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Required generated artifacts referenced for rendering (Req 7.6). */
const REQUIRED_ARTIFACTS = [
  "artifacts/lyrics.json",
  "artifacts/audio-analysis.json",
] as const;

/** Prefix under which uploaded assets live within a project scope. */
const ASSETS_PREFIX = "assets/";
/** Subprefix under which the 26 `Letter_Asset` SVGs live. */
const LETTERS_PREFIX = "assets/letters/";
/** Standardized location of the generated config artifact. */
const CONFIG_PATH = "artifacts/project-config.json";

/**
 * Build `project-config.json` for `project`, persist it under the owning
 * `Project_Id`, and return the assembled config (Req 7.1). The supplied
 * `project` record provides the metadata and requested `Video_Format`
 * (Req 7.4, 7.5).
 *
 * Every required item is checked first: the four single-instance assets, all 26
 * letters, and the two render artifacts. If anything is missing the request is
 * rejected with a `MISSING_REQUIREMENTS` error whose `details.missing` lists
 * each missing item — asset roles by name, letters as `letter:A`..`letter:Z`,
 * and artifacts by relative path (Req 7.7). No config is written on rejection.
 *
 * @returns `ok(config)` after a successful write, otherwise `err(ApiError)`.
 */
export async function buildConfig(
  projectId: string,
  store: AssetStore,
  project: ProjectRecord,
): Promise<Result<ProjectConfigJson, ApiError>> {
  // List once; resolve concrete asset paths tolerant of the stored extension.
  const assetPaths = await store.list(projectId, ASSETS_PREFIX);
  const topLevelAssets = indexTopLevelAssets(assetPaths);
  const presentPaths = new Set(assetPaths);

  const missing: string[] = [];
  for (const role of REQUIRED_ASSETS) {
    if (!topLevelAssets.has(ASSET_FILE_STEMS[role])) missing.push(role);
  }
  for (const letter of REQUIRED_LETTERS) {
    if (!presentPaths.has(letterPath(letter))) missing.push(`letter:${letter}`);
  }
  for (const artifact of REQUIRED_ARTIFACTS) {
    if (!(await store.exists({ projectId, relativePath: artifact }))) {
      missing.push(artifact);
    }
  }

  if (missing.length > 0) {
    // One rejection listing every missing item, not the first encountered (Req 7.7).
    return err(
      new ApiError("MISSING_REQUIREMENTS", "Cannot build config: required items are missing", {
        missing,
      }),
    );
  }

  const config: ProjectConfigJson = {
    version: 1,
    projectId,
    metadata: { songName: project.songName, singerName: project.singerName }, // Req 7.5
    videoFormat: project.videoFormat, // Req 7.4
    assets: collectAssetPaths(topLevelAssets), // Req 7.2
    artifacts: {
      lyrics: REQUIRED_ARTIFACTS[0],
      audioAnalysis: REQUIRED_ARTIFACTS[1],
    }, // Req 7.6
    layout: defaultLayout(project.videoFormat), // Req 7.3
  };

  await store.write(configRef(projectId), Buffer.from(JSON.stringify(config, null, 2)));
  return ok(config);
}

/**
 * Index the files stored directly under `assets/` (excluding the `letters/`
 * subtree) by their extension-less stem, so a role can be resolved to its
 * actual stored path regardless of the uploaded extension. When more than one
 * file shares a stem the first in sorted order wins.
 */
function indexTopLevelAssets(assetPaths: string[]): Map<string, string> {
  const byStem = new Map<string, string>();
  for (const relativePath of assetPaths) {
    if (relativePath.startsWith(LETTERS_PREFIX)) continue; // letters resolved separately
    const name = relativePath.slice(ASSETS_PREFIX.length);
    if (name.length === 0 || name.includes("/")) continue; // only top-level asset files
    const dot = name.lastIndexOf(".");
    const stem = dot <= 0 ? name : name.slice(0, dot);
    if (!byStem.has(stem)) byStem.set(stem, relativePath);
  }
  return byStem;
}

/**
 * Assemble {@link AssetPaths} from the resolved top-level asset index plus the
 * 26 letter paths keyed A–Z (Req 7.2). Callers must have verified presence; the
 * required stems are guaranteed to be indexed here.
 */
function collectAssetPaths(topLevelAssets: Map<string, string>): AssetPaths {
  const letters: Record<string, string> = {};
  for (const letter of REQUIRED_LETTERS) {
    letters[letter] = letterPath(letter);
  }
  return {
    background: topLevelAssets.get(ASSET_FILE_STEMS.background)!,
    songLogo: topLevelAssets.get(ASSET_FILE_STEMS.songLogo)!,
    channelLogo: topLevelAssets.get(ASSET_FILE_STEMS.channelLogo)!,
    audio: topLevelAssets.get(ASSET_FILE_STEMS.audio)!,
    letters,
  };
}

/**
 * Default layout for a project, selecting the template by `Video_Format` so the
 * Render_Engine can pick it by identifier (Req 7.3, 15.1). `both` and
 * `landscape` use the landscape template; `portrait` uses the portrait one.
 */
function defaultLayout(videoFormat: VideoFormat): LayoutDefinition {
  const template = videoFormat === "portrait" ? "classic-portrait" : "classic-landscape";
  return {
    template,
    lyricBox: { maxLines: 2 },
    bars: { left: false, right: false },
  };
}

/** Standardized storage path of a single `Letter_Asset` (Req 7.2). */
function letterPath(letter: string): string {
  return `${LETTERS_PREFIX}${letter}.svg`;
}

/** Address of the generated config artifact within a project scope. */
function configRef(projectId: string): AssetRef {
  return { projectId, relativePath: CONFIG_PATH };
}
