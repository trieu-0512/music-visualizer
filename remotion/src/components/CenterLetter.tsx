/**
 * Centered Letter_Asset layer (Req 10.3, 10.4).
 *
 * Renders the Letter_Asset for the active lyric line at the center of the
 * frame. The `scale` (from the `letterScale` selector) drives a beat/bass
 * bounce while `glow` (the `beatPulse` value `0..1`) drives a pulsing drop
 * shadow. Purely presentational: all reactive math is done by the selectors.
 */
import { AbsoluteFill, Img } from "remotion";
import { resolveAssetSrc } from "./assets.js";

/** Props for the {@link CenterLetter} layer. */
export interface CenterLetterProps {
  /** Project-relative path (or resolved URL) of the Letter_Asset SVG. */
  src: string;
  /** Box size of the centered letter in px. */
  size: number;
  /** Scale factor from `letterScale` (bounce), `>= 1` (Req 10.4). */
  scale: number;
  /** Beat-proximity glow `0..1` from `beatPulse` (Req 10.4). */
  glow: number;
  /** Vertical offset from center in px (negative = up). */
  offsetY?: number;
}

export const CenterLetter: React.FC<CenterLetterProps> = ({
  src,
  size,
  scale,
  glow,
  offsetY = 0,
}) => {
  // Glow intensity: spread/opacity grow with beat proximity.
  const glowRadius = 12 + 48 * glow;
  const glowAlpha = 0.35 + 0.45 * glow;
  return (
    <AbsoluteFill
      data-layer="center-letter"
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Img
        src={resolveAssetSrc(src)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          transform: `translateY(${offsetY}px) scale(${scale})`,
          filter: `drop-shadow(0 0 ${glowRadius}px rgba(255,255,255,${glowAlpha}))`,
        }}
      />
    </AbsoluteFill>
  );
};
