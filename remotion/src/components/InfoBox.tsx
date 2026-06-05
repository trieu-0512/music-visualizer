/**
 * Top-left information box (Req 10.7).
 *
 * Shows the square Song_Logo_Asset alongside the song name and singer name in
 * a blurred panel, matching the production frame reference.
 */
import { Img } from "remotion";
import { resolveAssetSrc } from "./assets.js";

/** Props for the {@link InfoBox} layer. */
export interface InfoBoxProps {
  /** Project-relative path (or resolved URL) of the Song_Logo_Asset. */
  logo: string;
  /** Song name from project metadata (Req 10.7). */
  songName: string;
  /** Singer name from project metadata (Req 10.7). */
  singerName: string;
  /** Distance from the top-left canvas corner in px. */
  margin: number;
  /** Square logo size in px. */
  logoSize: number;
  /** Song-name font size in px. */
  songFontSize: number;
  /** Singer-name font size in px. */
  singerFontSize: number;
  /** Inner padding of the box in px. */
  padding: number;
}

export const InfoBox: React.FC<InfoBoxProps> = ({
  logo,
  songName,
  singerName,
  margin,
  logoSize,
  songFontSize,
  singerFontSize,
  padding,
}) => {
  return (
    <div
      data-layer="info-box"
      style={{
        position: "absolute",
        top: margin,
        left: margin,
        display: "flex",
        alignItems: "center",
        gap: padding + 8,
        padding,
        borderRadius: 20,
        background: "rgba(70,70,70,0.52)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35)",
        border: "1px solid rgba(255,255,255,0.22)",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        maxWidth: "46%",
      }}
    >
      <Img
        src={resolveAssetSrc(logo)}
        style={{
          width: logoSize,
          height: logoSize,
          objectFit: "cover",
          flexShrink: 0,
          borderRadius: 16,
          boxShadow: "0 5px 14px rgba(0,0,0,0.25)",
          background: "rgba(255,255,255,0.2)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          data-field="song-name"
          style={{
            fontSize: songFontSize,
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {songName}
        </span>
        <span
          data-field="singer-name"
          style={{
            fontSize: singerFontSize,
            fontWeight: 400,
            opacity: 0.85,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {singerName}
        </span>
      </div>
    </div>
  );
};
