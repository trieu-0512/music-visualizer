/**
 * Classic portrait (9x16) template.
 *
 * Wires the canonical artifacts to the shared {@link ClassicScene} layer stack
 * with the portrait placement constants. The layer stack is identical to the
 * landscape template — blurred RMS-reactive background + overlay, centered
 * Letter_Asset with beat/bass scale + glow, left/right audio bars, top-left
 * info box, circular top-right channel logo, bottom karaoke lyric box, preview
 * audio (Req 10.1–10.9) — and differs only in the layout constants and the
 * selected template id (design "Template Composition").
 */
import { ClassicScene } from "../components/ClassicScene.js";
import { PORTRAIT_LAYOUT } from "../components/layout.js";
import type { TemplateProps } from "./types.js";

/** Template identifier for the portrait variant (Req 15.1). */
export const CLASSIC_PORTRAIT_ID = "classic-portrait";

export const ClassicPortrait: React.FC<TemplateProps> = ({
  config,
  lyrics,
  analysis,
}) => {
  return (
    <ClassicScene
      config={config}
      lyrics={lyrics}
      analysis={analysis}
      layout={PORTRAIT_LAYOUT}
    />
  );
};
