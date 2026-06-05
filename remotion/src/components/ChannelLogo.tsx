/**
 * Top-right circular channel logo (Req 10.8).
 *
 * Renders the Channel_Logo_Asset clipped to a circle in the top-right corner
 * with a visible ring, matching the production frame reference.
 */
import { Img } from "remotion";
import { resolveAssetSrc } from "./assets.js";

/** Props for the {@link ChannelLogo} layer. */
export interface ChannelLogoProps {
  /** Project-relative path (or resolved URL) of the Channel_Logo_Asset. */
  src: string;
  /** Distance from the top-right canvas corner in px. */
  margin: number;
  /** Diameter of the circular logo in px. */
  size: number;
}

export const ChannelLogo: React.FC<ChannelLogoProps> = ({
  src,
  margin,
  size,
}) => {
  return (
    <div
      data-layer="channel-logo"
      style={{
        position: "absolute",
        top: margin,
        right: margin,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "5px solid rgba(255,255,255,0.95)",
        outline: "4px solid rgba(246,154,42,0.92)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.24)",
        background: "rgba(255,255,255,0.88)",
      }}
    >
      <Img
        src={resolveAssetSrc(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
