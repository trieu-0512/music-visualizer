/**
 * Top-level composition component bound to both the landscape and portrait
 * Remotion `Composition`s.
 *
 * `Video` is format-agnostic: it receives the canonical artifacts as input
 * props and delegates all pixels to the template selected by the
 * `layout.template` identifier in the config (Req 15.1, 10.10). The concrete
 * landscape/portrait layer stacks live in `./templates/*` (task 10.2).
 */
import type { AudioAnalysisJson, LyricsJson, ProjectConfigJson } from "@music-visualizer/shared";
import { resolveTemplate } from "./templates/index.js";

/**
 * Input props for the {@link Video} composition component.
 *
 * Declared as a type alias (not an interface) so it satisfies Remotion's
 * `Record<string, unknown>` props constraint on `Composition`.
 */
export type VideoProps = {
  config: ProjectConfigJson;
  lyrics: LyricsJson;
  analysis: AudioAnalysisJson;
};

export const Video: React.FC<VideoProps> = ({ config, lyrics, analysis }) => {
  const Template = resolveTemplate(config.layout.template);
  return <Template config={config} lyrics={lyrics} analysis={analysis} />;
};
