/**
 * Shared prop contract for every Render_Engine template.
 *
 * A template is a pure React component of the canonical artifacts plus the
 * current frame (supplied by Remotion hooks inside the component). Keeping the
 * prop shape centralized lets the {@link TEMPLATES} registry treat every
 * template uniformly and lets new templates be added by introducing new
 * identifiers (Req 10.10, 15.1).
 *
 * The artifact types come straight from `@music-visualizer/shared` so the
 * Web_App preview, the headless render, and the workers all reference one
 * consistent schema (Req 15.4).
 */
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "@music-visualizer/shared";

/** Input props passed to every template component. */
export interface TemplateProps {
  /** The resolved `project-config.json` (assets, layout, metadata). */
  config: ProjectConfigJson;
  /** The aligned `lyrics.json` driving the lyric box and centered letter. */
  lyrics: LyricsJson;
  /** The `audio-analysis.json` driving audio-reactive visuals. */
  analysis: AudioAnalysisJson;
}
