/**
 * Asset source resolver for the Render_Engine templates.
 *
 * `project-config.json` references every asset by a **project-relative storage
 * path** (e.g. `"assets/background.jpg"`, `"assets/letters/T.svg"`). Remotion's
 * `<Img>` / `<Audio>` need a URL the browser/Chromium can actually load, so the
 * templates pass each stored path through {@link resolveAssetSrc}.
 *
 * Resolution contract (documented assumption shared by preview task 12.3 and
 * the headless render task 10.4):
 *
 *  - If a path is already a **fully-resolved location** — an absolute URL
 *    (`http(s)://`, protocol-relative `//`), a `data:`/`blob:` URI, a
 *    root-absolute path (`/...`), a `file://` URL, or a Windows drive path
 *    (`C:\...`) — it is passed through unchanged. This lets the preview rewrite
 *    `config.assets.*` to absolute API-served URLs, and lets the headless render
 *    rewrite them to `file://` / served URLs, before handing the config to the
 *    composition.
 *  - Otherwise the value is treated as a path relative to Remotion's `public/`
 *    directory and resolved with `staticFile`. This supports the simple local
 *    convention of staging a project's assets under `remotion/public/` for
 *    Studio preview.
 *
 * Keeping resolution in one helper means neither template constructs URLs by
 * hand and the strategy can change in exactly one place (Req 13.3, 15.2).
 */
import { staticFile } from "remotion";

/** Matches a value that is already a fully-resolved, loadable location. */
const ALREADY_RESOLVED =
  /^(https?:)?\/\/|^(data|blob|file):|^\/|^[a-zA-Z]:[\\/]/;

/**
 * Map a `project-config.json` asset path to a URL Remotion can load.
 *
 * Fully-resolved locations pass through unchanged; bare project-relative paths
 * resolve against Remotion's `public/` directory via `staticFile`.
 */
export function resolveAssetSrc(path: string): string {
  if (!path) return path;
  if (ALREADY_RESOLVED.test(path)) return path;
  return staticFile(path);
}
