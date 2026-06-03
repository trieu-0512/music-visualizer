/**
 * Top-left information box (Req 10.7).
 *
 * Shows the Song_Logo_Asset alongside the song name and singer name from the
 * project metadata. Purely presentational.
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
        gap: padding,
        padding,
        borderRadius: 16,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(6px)",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        maxWidth: "60%",
      }}
    >
      <Img
        src={resolveAssetSrc(logo)}
        style={{
          width: logoSize,
          height: logoSize,
          objectFit: "contain",
          flexShrink: 0,
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
