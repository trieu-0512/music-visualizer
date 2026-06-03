/**
 * Left/right audio bar columns (Req 10.9).
 *
 * Renders a vertical stack of bars pinned to the left or right edge whose
 * lengths come from the `barHeights` selector (a blend of frequency-band energy
 * and overall volume). The component is purely presentational; all height math
 * — including range clamping — is done by the selector.
 */
import { AbsoluteFill } from "remotion";
import { barHeights } from "../selectors.js";

/** Props for one {@link AudioBars} column. */
export interface AudioBarsProps {
  /** Which edge the column hugs. */
  side: "left" | "right";
  /** Overall volume `0..1` (RMS) blended into every bar (Req 10.9). */
  rms: number;
  /** Frequency-band energies `0..1` at the current time (Req 10.9). */
  bands: number[];
  /** Number of bars to render per side. */
  count: number;
  /** Maximum bar length (px) growing inward from the edge. */
  maxLength: number;
  /** Thickness of each bar (px). */
  thickness: number;
  /** Vertical gap between bars (px). */
  gap: number;
  /** Inset of the column from the canvas edge (px). */
  edgeInset: number;
}

/**
 * Expand the available bands to exactly `count` values by repeating/sampling so
 * the visual column always has the requested number of bars regardless of how
 * many analysis bands exist.
 */
function fitBands(bands: number[], count: number): number[] {
  if (count <= 0) return [];
  if (bands.length === 0) return new Array(count).fill(0);
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.floor((i / count) * bands.length);
    return bands[Math.min(idx, bands.length - 1)] ?? 0;
  });
}

export const AudioBars: React.FC<AudioBarsProps> = ({
  side,
  rms,
  bands,
  count,
  maxLength,
  thickness,
  gap,
  edgeInset,
}) => {
  const fitted = fitBands(bands, count);
  const lengths = barHeights(fitted, rms, maxLength);
  return (
    <AbsoluteFill
      data-layer={`audio-bars-${side}`}
      style={{
        flexDirection: "column",
        justifyContent: "center",
        alignItems: side === "left" ? "flex-start" : "flex-end",
        paddingLeft: side === "left" ? edgeInset : 0,
        paddingRight: side === "right" ? edgeInset : 0,
        gap,
        pointerEvents: "none",
      }}
    >
      {lengths.map((len, i) => (
        <div
          // Bars are positional and stable in count, so index keys are fine.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          data-bar={i}
          style={{
            width: Math.max(0, len),
            height: thickness,
            borderRadius: thickness / 2,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(180,210,255,0.65) 100%)",
            ...(side === "right"
              ? { transformOrigin: "right center" }
              : { transformOrigin: "left center" }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
