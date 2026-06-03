/**
 * Preview asset + format helpers (`frontend`, task 12.3).
 *
 * The Remotion preview drives the `@music-visualizer/remotion` `Video`
 * composition from a project's `project-config.json`. That config references
 * every asset by a **project-relative storage path** (e.g.
 * `"assets/background.jpg"`, `"assets/letters/T.svg"`), but the in-browser
 * Remotion Player needs URLs the browser can actually load. The Render_Engine's
 * `resolveAssetSrc` (remotion `components/assets.ts`) passes already-absolute
 * locations through unchanged, so this module rewrites each `config.assets.*`
 * entry to an absolute API URL before the config is handed to the Player.
 *
 * ## Asset-URL resolution + known limitation
 *
 * Bare project-relative paths are rewritten to
 * `${apiBaseUrl}/projects/:id/<relativePath>` — e.g.
 * `assets/background.jpg` -> `http://localhost:3000/projects/p1/assets/background.jpg`.
 * The base URL is recovered from the typed {@link ApiClient}'s public
 * `artifactUrl` so this helper needs no access to the client's private base URL
 * and no change to the client API.
 *
 * NOTE (documented limitation): the API_Service currently exposes **no GET
 * route that serves stored assets** — only `GET /projects/:id/artifacts/:name`
 * serves generated artifacts. The preview therefore points asset `src`s at the
 * forward-compatible `/projects/:id/assets/...` shape, which will 404 until an
 * asset-serving route is added (a follow-up to the backend asset routes). The
 * preview still renders the full composition structure, the lyric/letter
 * timing, and the audio-reactive layout driven by `lyrics.json` /
 * `audio-analysis.json`; only the bitmap assets may be missing in preview.
 */
import type { ProjectConfigJson, VideoFormat } from "../api/index.js";

/** A selectable preview format mapped to a composition size + template id. */
export interface PreviewFormat {
  /** Stable selector id / radio value. */
  id: "landscape" | "portrait";
  /** Human-readable label for the selector. */
  label: string;
  /** Composition width handed to the Player (Req 8.4). */
  width: number;
  /** Composition height handed to the Player (Req 8.4). */
  height: number;
  /** `layout.template` identifier driving the composition (Req 15.1). */
  template: string;
}

/**
 * The preview formats the user can switch between (Req 8.4). Both are always
 * offered so a project can be previewed in either orientation regardless of its
 * configured `videoFormat`; the configured format selects the default.
 */
export const PREVIEW_FORMATS: readonly PreviewFormat[] = [
  {
    id: "landscape",
    label: "Landscape (16:9)",
    width: 1920,
    height: 1080,
    template: "classic-landscape",
  },
  {
    id: "portrait",
    label: "Portrait (9:16)",
    width: 1080,
    height: 1920,
    template: "classic-portrait",
  },
] as const;

/**
 * Choose the default preview format id from the project's requested
 * `Video_Format`: a portrait-only project starts portrait, everything else
 * (landscape / both) starts landscape.
 */
export function defaultPreviewFormatId(
  videoFormat: VideoFormat,
): PreviewFormat["id"] {
  return videoFormat === "portrait" ? "portrait" : "landscape";
}

/** Look up a preview format by id, falling back to the first (landscape). */
export function findPreviewFormat(id: string): PreviewFormat {
  return PREVIEW_FORMATS.find((f) => f.id === id) ?? PREVIEW_FORMATS[0]!;
}

/** Matches a value that is already a fully-resolved, loadable location. */
const ALREADY_ABSOLUTE = /^(https?:)?\/\/|^(data|blob|file):|^\//;

/** The minimal slice of {@link ApiClient} this helper depends on. */
export interface AssetUrlClient {
  /** Build the absolute download URL for a standardized artifact. */
  artifactUrl(projectId: string, name: string): string;
}

/**
 * Recover the API_Service base URL from the client's public `artifactUrl`.
 *
 * `artifactUrl(id, name)` returns `${baseUrl}/projects/:id/artifacts/:name`, so
 * slicing off the well-known suffix yields the base URL without reaching into
 * the client's private fields.
 */
export function apiBaseUrl(client: AssetUrlClient, projectId: string): string {
  const probe = client.artifactUrl(projectId, "lyrics.json");
  const marker = `/projects/${encodeURIComponent(projectId)}/artifacts/`;
  const idx = probe.indexOf(marker);
  return idx >= 0 ? probe.slice(0, idx) : "";
}

/**
 * Map one config asset path to a URL the browser can load. Already-absolute
 * locations pass through unchanged (so the Render_Engine resolver leaves them
 * alone); bare project-relative paths become `${base}/projects/:id/<path>`.
 */
export function resolveAssetUrl(
  base: string,
  projectId: string,
  path: string,
): string {
  if (!path) return path;
  if (ALREADY_ABSOLUTE.test(path)) return path;
  const rel = path.replace(/^\/+/, "");
  return `${base}/projects/${encodeURIComponent(projectId)}/${rel}`;
}

/**
 * Return a copy of `config` with every asset path rewritten to an absolute API
 * URL so the in-browser Remotion Player can load them (see module note on the
 * current asset-serving limitation).
 */
export function resolveConfigAssetUrls(
  client: AssetUrlClient,
  projectId: string,
  config: ProjectConfigJson,
): ProjectConfigJson {
  const base = apiBaseUrl(client, projectId);
  const toUrl = (p: string): string => resolveAssetUrl(base, projectId, p);
  const letters: Record<string, string> = Object.fromEntries(
    Object.entries(config.assets.letters).map(([key, value]) => [key, toUrl(value)]),
  );
  return {
    ...config,
    assets: {
      ...config.assets,
      background: toUrl(config.assets.background),
      songLogo: toUrl(config.assets.songLogo),
      channelLogo: toUrl(config.assets.channelLogo),
      audio: toUrl(config.assets.audio),
      letters,
    },
  };
}

/** Return a copy of `config` whose layout uses the given template id. */
export function withTemplate(
  config: ProjectConfigJson,
  template: string,
): ProjectConfigJson {
  return { ...config, layout: { ...config.layout, template } };
}
