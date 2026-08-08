/**
 * Center visual layer (Req 10.3, 10.4).
 *
 * Renders the Letter_Asset for the active lyric line plus the derived object
 * word in a fixed two-column stage. The `scale`, `glow`, and `wobble` values
 * drive subtle bounce and shake while keeping the base layout stable.
 */
import { AbsoluteFill, Img } from "remotion";
import { resolveAssetSrc } from "./assets.js";

/** Props for the {@link CenterLetter} layer. */
export interface CenterLetterProps {
  /** Project-relative path (or resolved URL) of the Letter_Asset SVG. */
  src: string;
  /** Resolved A-Z key for the active line. */
  letter: string;
  /** Processed transparent object image for theme-first projects. */
  objectSrc?: string;
  /** Canonical object word from mapping, or legacy lyric-derived fallback. */
  objectWord?: string;
  /** Box size of the centered letter in px. */
  size: number;
  /** Object word font size in px. */
  objectWordFontSize: number;
  /** Scale factor from `letterScale` (bounce), `>= 1` (Req 10.4). */
  scale: number;
  /** Beat-proximity glow `0..1` from `beatPulse` (Req 10.4). */
  glow: number;
  /** Small rotation in degrees for the shake effect. */
  wobble?: number;
  /** Vertical offset from center in px (negative = up). */
  offsetY?: number;
}

export const CenterLetter: React.FC<CenterLetterProps> = ({
  src,
  letter,
  objectSrc,
  objectWord,
  size,
  objectWordFontSize,
  scale,
  glow,
  wobble = 0,
  offsetY = 0,
}) => {
  // Glow intensity: spread/opacity grow with beat proximity.
  const glowRadius = 10 + 34 * glow;
  const glowAlpha = 0.26 + 0.38 * glow;
  const displayWord = (objectWord || "").trim();
  return (
    <AbsoluteFill
      data-layer="center-letter"
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        data-layer="center-stage"
        style={{
          width: "84%",
          height: "48%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          justifyItems: "center",
          columnGap: "4%",
          transform: `translateY(${offsetY}px)`,
        }}
      >
        <Img
          src={resolveAssetSrc(src)}
          alt={letter}
          style={{
            width: size,
            height: size,
            objectFit: "contain",
            transform: `scale(${scale}) rotate(${-wobble}deg)`,
            filter: `drop-shadow(0 0 ${glowRadius}px rgba(255,255,255,${glowAlpha})) drop-shadow(0 12px 18px rgba(0,0,0,0.12))`,
          }}
        />
        <div
          data-layer="object-visual"
          style={{
            display: objectSrc || displayWord ? "flex" : "none",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: Math.max(8, Math.round(objectWordFontSize * 0.12)),
            minWidth: 0,
            transform: `scale(${1 + (scale - 1) * 0.72}) rotate(${wobble}deg)`,
            filter: `drop-shadow(0 0 ${Math.max(6, glowRadius * 0.45)}px rgba(72,190,86,${0.18 + 0.25 * glow}))`,
          }}
        >
          {objectSrc && (
            <Img
              src={resolveAssetSrc(objectSrc)}
              alt={displayWord || `${letter} object`}
              data-layer="object-image"
              style={{
                width: size,
                height: size * 0.78,
                objectFit: "contain",
              }}
            />
          )}
          {displayWord && (
          <div
            data-layer="object-word"
            data-object-word={displayWord}
            style={{
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: objectWordFontSize,
              fontWeight: 900,
              lineHeight: 0.95,
              color: "#20a64a",
              textTransform: "uppercase",
              letterSpacing: 0,
              WebkitTextStroke: `${Math.max(2, Math.round(objectWordFontSize * 0.035))}px rgba(3,115,32,0.55)`,
              textShadow:
                "0 6px 0 rgba(2,124,38,0.22), 0 12px 18px rgba(0,0,0,0.16)",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {displayWord}
          </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
