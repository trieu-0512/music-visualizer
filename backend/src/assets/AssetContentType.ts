/**
 * Content types for serving stored assets (`backend`, Req 8.x preview support).
 *
 * The preview (Remotion Player) and a headless render load a project's stored
 * assets — background, logos, audio, processed letters, and theme-first objects — by URL. The
 * asset-serving route streams the bytes out of the Asset_Store and uses this
 * map to pick a sensible `Content-Type` from the file extension so browsers
 * decode images/audio/SVG correctly. Unknown extensions fall back to
 * `application/octet-stream`.
 */

/** Map an asset file extension to the `Content-Type` it should be served with. */
const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

/**
 * Pick a `Content-Type` for an asset from its relative path's extension,
 * defaulting to `application/octet-stream` for anything unrecognized.
 */
export function assetContentType(relativePath: string): string {
  const dot = relativePath.lastIndexOf(".");
  const ext = dot >= 0 ? relativePath.slice(dot).toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
