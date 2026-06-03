/**
 * Classic landscape (16x9) template.
 *
 * Wires the canonical artifacts to the shared {@link ClassicScene} layer stack
 * with the landscape placement constants. The scene renders the blurred,
 * RMS-reactive background + overlay, the centered Letter_Asset with beat/bass
 * scale + glow, left/right audio bars, the top-left info box, the circular
 * top-right channel logo, the bottom karaoke lyric box, and the preview audio
 * (Req 10.1–10.9). Landscape and portrait differ only in the layout constants
 * and the selected template id (design "Template Composition").
 */
import { ClassicScene } from "../components/ClassicScene.js";
import { LANDSCAPE_LAYOUT } from "../components/layout.js";
import type { TemplateProps } from "./types.js";

/** Template identifier for the landscape variant (Req 15.1). */
export const CLASSIC_LANDSCAPE_ID = "classic-landscape";

export const ClassicLandscape: React.FC<TemplateProps> = ({
  config,
  lyrics,
  analysis,
}) => {
  return (
    <ClassicScene
      config={config}
      lyrics={lyrics}
      analysis={analysis}
      layout={LANDSCAPE_LAYOUT}
    />
  );
};
