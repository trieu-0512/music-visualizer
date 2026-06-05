/**
 * Blurred, audio-reactive background layer (Req 10.1, 10.2).
 *
 * Renders the Background_Asset full-frame with a blur effect, an RMS-driven
 * zoom (`scale`) and brightness, and a contrast overlay on top so the
 * foreground letter and lyrics stay readable. `scale`/`brightness` come from the
 * `backgroundDynamics` selector so this component stays purely presentational.
 */
import { AbsoluteFill, Img } from "remotion";
import { resolveAssetSrc } from "./assets.js";

/** Props for the {@link Background} layer. */
export interface BackgroundProps {
  /** Project-relative path (or resolved URL) of the Background_Asset. */
  src: string;
  /** Blur radius in px (Req 10.1). */
  blur: number;
  /** RMS-driven zoom factor, `>= 1` (Req 10.2). */
  scale: number;
  /** RMS-driven brightness multiplier (Req 10.2). */
  brightness: number;
  /** Whether to draw the darkening overlay (Req 10.1). */
  overlay?: boolean;
  /** Whether the overlay should brighten or darken the scene. */
  overlayTone?: "light" | "dark";
}

export const Background: React.FC<BackgroundProps> = ({
  src,
  blur,
  scale,
  brightness,
  overlay = true,
  overlayTone = "dark",
}) => {
  const overlayBackground =
    overlayTone === "light"
      ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.78) 54%, rgba(255,249,244,0.88) 100%)"
      : "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)";

  return (
    <AbsoluteFill data-layer="background">
      <Img
        src={resolveAssetSrc(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // Slight base zoom so the blur edges never reveal the canvas as the
          // RMS scale animates around 1.0.
          transform: `scale(${1.06 * scale})`,
          filter: `blur(${blur}px) brightness(${brightness}) saturate(1.08)`,
        }}
      />
      {overlay && (
        <AbsoluteFill
          data-layer="background-overlay"
          style={{
            background: overlayBackground,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
