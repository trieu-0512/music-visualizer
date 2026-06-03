/**
 * Types for the project configuration artifact `project-config.json`
 * (Req 7, Req 15.4).
 *
 * Produced by the Config_Builder and consumed by the Render_Engine (preview
 * and headless render). The matching JSON Schema lives at
 * `shared/src/schema/project-config.schema.json`.
 */

/** Requested output orientation set (Req 7.4). */
export type VideoFormat = "landscape" | "portrait" | "both";

/** Storage paths of the assets referenced by a project (Req 7.2). */
export interface AssetPaths {
  background: string;
  songLogo: string;
  channelLogo: string;
  audio: string;
  /** `"A".."Z"` -> path (26 entries). */
  letters: Record<string, string>;
}

/** Layout definition and selected template identifier (Req 7.3, 15.1). */
export interface LayoutDefinition {
  /** Template identifier selected by the Render_Engine (Req 15.1). */
  template: string;
  lyricBox: { maxLines: 1 | 2 };
  bars: { left: boolean; right: boolean };
  // additional placement values resolved per template
}

/** The `project-config.json` artifact (Req 7.1–7.6). */
export interface ProjectConfigJson {
  version: 1;
  projectId: string;
  metadata: { songName: string; singerName: string };
  videoFormat: VideoFormat;
  assets: AssetPaths;
  artifacts: { lyrics: string; audioAnalysis: string };
  layout: LayoutDefinition;
}
