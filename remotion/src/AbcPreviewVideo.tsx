import { useEffect, useState, type CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { resolveAssetSrc } from "./components/assets.js";

const PREVIEW_PREROLL_SECONDS = 1;
const TIME_EPSILON = 0.035;
const FONT_DISPLAY =
  '"Fredoka", "Arial Rounded MT Bold", "Comic Sans MS", "Trebuchet MS", Arial, sans-serif';
const FONT_IMPORT_CSS =
  '@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700;800;900&display=swap");';
const FONT_LOAD_SAMPLES = [
  "500 58px Fredoka",
  "600 58px Fredoka",
  "700 58px Fredoka",
  "800 58px Fredoka",
  "900 58px Fredoka",
];

export interface AssetMeta {
  src: string;
  file: {
    w: number;
    h: number;
  };
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  groupBbox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  wordBbox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  includesObjectWord?: boolean;
}

interface LetterAssets {
  letter: AssetMeta;
  object: AssetMeta;
  objectName: string;
}

interface PreviewLine {
  index: number;
  start: number;
  end: number;
  text: string;
  line1: string;
  line2?: string;
  letter?: string | null;
  object?: string;
}

interface PreviewLayout {
  canvasWidth: number;
  canvasHeight: number;
  assetHeight: number;
  assetY: number;
  letterX: number;
  objectX: number;
  letterScale: number;
  objectScale: number;
  objectLabelFont: number;
  objectLabelGap: number;
  bgBlur: number;
  lyricBottom: number;
  lyricWidth: number;
  lyricHeight?: number;
  lyricFont: number;
  infoTop: number;
  infoLeft: number;
  logoTop: number;
  logoRight: number;
  assetGap?: number;
  assetHorizontalPadding?: number;
}

export interface AbcPreviewData {
  metadata: {
    songCode?: string;
    title?: string;
    artist?: string;
  };
  assets: {
    background?: string;
    backgroundRender?: string;
    songLogo?: string;
    audio?: string;
  };
  letters: Record<string, LetterAssets>;
  lines: PreviewLine[];
  layout: PreviewLayout;
}

export interface AbcPreviewProps extends Record<string, unknown> {
  data: AbcPreviewData;
}

export const defaultAbcPreviewProps: AbcPreviewProps = {
  data: {
    metadata: {
      songCode: "ABC",
      title: "Classroom ABC",
      artist: "ABC Kids Music",
    },
    assets: {},
    letters: {},
    lines: [
      {
        index: 0,
        start: 0,
        end: 4,
        text: "ABC preview",
        line1: "ABC preview",
        line2: "",
        letter: null,
        object: "",
      },
    ],
    layout: {
      canvasWidth: 1920,
      canvasHeight: 1080,
      assetHeight: 520,
      assetY: 520,
      letterX: 565,
      objectX: 1325,
      letterScale: 1.02,
      objectScale: 0.92,
      objectLabelFont: 82,
      objectLabelGap: 14,
      bgBlur: 0,
      lyricBottom: 48,
      lyricWidth: 1740,
      lyricFont: 58,
      infoTop: 24,
      infoLeft: 24,
      logoTop: 22,
      logoRight: 34,
    },
  },
};

export function abcPreviewDurationInFrames(
  props: AbcPreviewProps,
  fps: number,
): number {
  const maxLineEnd = props.data.lines.reduce(
    (max, line) => Math.max(max, line.end),
    0,
  );
  return Math.max(1, Math.ceil((maxLineEnd + 1) * fps));
}

function previewStartForLine(line: PreviewLine): number {
  return Math.max(0, line.start - PREVIEW_PREROLL_SECONDS);
}

function previewEndForLine(lines: PreviewLine[], index: number): number {
  const nextLine = lines[index + 1];
  if (nextLine) return previewStartForLine(nextLine);
  return lines[index]?.end ?? 0;
}

function nextLetterLineIndex(lines: PreviewLine[], index: number): number {
  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i]?.letter) return i;
  }
  return -1;
}

function findLineAt(lines: PreviewLine[], time: number): number {
  if (lines.length === 0) return -1;
  let best = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const start = previewStartForLine(line);
    const end = previewEndForLine(lines, i);
    if (time + TIME_EPSILON >= start && time < end) return i;
    if (start <= time + TIME_EPSILON) best = i;
  }
  return best;
}

function assetHideAt(lines: PreviewLine[], index: number): number {
  const line = lines[index];
  if (!line) return 0;
  const nextIndex = nextLetterLineIndex(lines, index);
  const nextPreStart =
    nextIndex >= 0 ? previewStartForLine(lines[nextIndex]!) : Infinity;
  return Math.min(line.end + 0.12, nextPreStart);
}

function findAssetLineAt(lines: PreviewLine[], time: number): number {
  let candidate = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line.letter) continue;
    const preStart = previewStartForLine(line);
    if (time + TIME_EPSILON >= preStart) {
      candidate = i;
    } else {
      break;
    }
  }
  if (candidate < 0) return -1;
  return time < assetHideAt(lines, candidate) ? candidate : -1;
}

export interface PlacedAsset {
  left: number;
  top: number;
  width: number;
  height: number;
  visibleLeft: number;
  visibleTop: number;
  visibleRight: number;
  visibleBottom: number;
  visibleW: number;
  visibleH: number;
}

/** Place an image from its visible alpha bounds rather than its PNG canvas. */
export function calculatePlacedAsset(
  meta: AssetMeta,
  centerX: number,
  centerY: number,
  targetHeight: number,
): PlacedAsset {
  // Align the visible alpha bounds, not the transparent PNG canvas. An
  // embedded object word is part of groupBbox, so both sides share the exact
  // same visible top and bottom pixels.
  const visual = meta.groupBbox ?? meta.bbox;
  const scale = targetHeight / Math.max(1, visual.h);
  const width = meta.file.w * scale;
  const height = meta.file.h * scale;
  const bboxCenterX = (visual.x + visual.w / 2) * scale;
  const bboxCenterY = (visual.y + visual.h / 2) * scale;
  const left = centerX - bboxCenterX;
  const top = centerY - bboxCenterY;
  const visibleW = visual.w * scale;
  const visibleH = visual.h * scale;
  const visibleLeft = left + visual.x * scale;
  const visibleTop = top + visual.y * scale;
  return {
    left,
    top,
    width,
    height,
    visibleLeft,
    visibleTop,
    visibleRight: visibleLeft + visibleW,
    visibleBottom: visibleTop + visibleH,
    visibleW,
    visibleH,
  };
}

export interface ObjectGroupPlacementOptions {
  canvasHeight: number;
  assetHeight: number;
  assetY: number;
  objectScale: number;
  lyricBottom: number;
  lyricHeight: number;
  groupGap: number;
}

export function calculateObjectGroupCenterY(
  meta: AssetMeta,
  options: ObjectGroupPlacementOptions,
): number {
  const preferredCenterY = options.assetY;
  const visualHeight = (meta.groupBbox ?? meta.bbox).h;
  const lyricTop = options.canvasHeight - options.lyricBottom - options.lyricHeight;
  const maximumGroupBottom = lyricTop - options.groupGap;
  const maximumCenterY = maximumGroupBottom - options.assetHeight / 2;
  const minimumCenterY = options.assetHeight / 2;
  // The pair-placement algorithm normalizes visualHeight to assetHeight. Keep
  // this guard for malformed metadata without changing the normal center.
  if (visualHeight <= 0) return preferredCenterY;
  return Math.min(preferredCenterY, Math.max(minimumCenterY, maximumCenterY));
}

export interface AssetPairPlacementOptions {
  canvasWidth: number;
  assetHeight: number;
  /** Optional vertical cap shared by the letter and the complete object group. */
  maxAssetHeight?: number;
  letterScale: number;
  objectScale: number;
  assetGap: number;
  assetHorizontalPadding: number;
}

export interface AssetPairPlacement {
  assetHeight: number;
  letterX: number;
  objectX: number;
  visualGap: number;
  letterWidth: number;
  objectWidth: number;
}

function horizontalExtents(
  meta: AssetMeta,
  assetHeight: number,
): { left: number; right: number; width: number } {
  const visual = meta.groupBbox ?? meta.bbox;
  const scale = assetHeight / Math.max(1, visual.h);
  const anchorX = visual.x + visual.w / 2;
  const left = (anchorX - visual.x) * scale;
  const right = (visual.x + visual.w - anchorX) * scale;
  return { left, right, width: left + right };
}

export function calculateAssetPairPlacement(
  letter: AssetMeta,
  object: AssetMeta,
  options: AssetPairPlacementOptions,
): AssetPairPlacement {
  const requestedGap = Math.max(0, options.assetGap);
  const availableWidth = Math.max(
    1,
    options.canvasWidth - options.assetHorizontalPadding * 2,
  );
  const letterWidthPerHeight = horizontalExtents(letter, 1).width;
  const objectWidthPerHeight = horizontalExtents(object, 1).width;
  const widthPerHeight = letterWidthPerHeight + objectWidthPerHeight;
  const maximumHeight =
    widthPerHeight > 0
      ? Math.max(1, (availableWidth - requestedGap) / widthPerHeight)
      : options.assetHeight;
  const requestedHeight = Math.min(
    options.assetHeight,
    options.maxAssetHeight ?? Number.POSITIVE_INFINITY,
  );
  const assetHeight = Math.min(Math.max(1, requestedHeight), maximumHeight);
  const letterExtents = horizontalExtents(letter, assetHeight);
  const objectExtents = horizontalExtents(object, assetHeight);
  const totalWidth = letterExtents.width + requestedGap + objectExtents.width;
  const leftEdge = (options.canvasWidth - totalWidth) / 2;
  const letterX = leftEdge + letterExtents.left;
  const letterRight = leftEdge + letterExtents.width;
  const objectLeft = letterRight + requestedGap;
  const objectX = objectLeft + objectExtents.left;

  return {
    assetHeight,
    letterX,
    objectX,
    visualGap: objectLeft - letterRight,
    letterWidth: letterExtents.width,
    objectWidth: objectExtents.width,
  };
}

function cleanWord(value: string): string {
  return value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function wordRole(
  word: string,
  letter: string,
  objectName: string,
): "letter" | "object" | "normal" {
  const clean = cleanWord(word);
  if (letter && clean === letter.toLowerCase()) return "letter";
  if (objectName && clean === objectName.toLowerCase()) return "object";
  return "normal";
}

function rowWords(row: string): string[] {
  return row.trim().split(/\s+/).filter(Boolean);
}

function titleCaseObject(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

function clampFrameProgress(
  frame: number,
  startFrame: number,
  endFrame: number,
): number {
  if (endFrame <= startFrame) return 1;
  return interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

const textOverflowStyle: CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function useFredokaFont(): void {
  const [handle] = useState(() => delayRender("Load Fredoka font"));

  useEffect(() => {
    let cancelled = false;

    const loadFont = async () => {
      try {
        if (typeof document !== "undefined" && document.fonts) {
          await Promise.all(
            FONT_LOAD_SAMPLES.map((sample) => document.fonts.load(sample)),
          );
          await document.fonts.ready;
        }
        if (!cancelled) {
          continueRender(handle);
        }
      } catch (error) {
        if (!cancelled) {
          cancelRender(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    void loadFont();

    return () => {
      cancelled = true;
    };
  }, [handle]);
}

export const AbcPreviewVideo: React.FC<AbcPreviewProps> = ({ data }) => {
  useFredokaFont();

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const layout = data.layout;
  const lyricIndex = findLineAt(data.lines, time);
  const lyricLine = lyricIndex >= 0 ? data.lines[lyricIndex] : null;
  const assetIndex = findAssetLineAt(data.lines, time);
  const assetLine = assetIndex >= 0 ? data.lines[assetIndex] : null;
  const activeLetter = assetLine?.letter ?? "";
  const activeAssets = activeLetter ? data.letters[activeLetter] : null;
  const title = data.metadata.title || data.metadata.songCode || "ABC";
  const artist = data.metadata.artist || "";
  const backgroundSrc = data.assets.backgroundRender || data.assets.background;
  const hasPrebakedBackground = Boolean(data.assets.backgroundRender);


  let letterNode: React.ReactNode = null;
  let objectNode: React.ReactNode = null;
  let objectLabelNode: React.ReactNode = null;

  if (activeAssets && assetLine) {
    const lyricHeight = layout.lyricHeight ?? 220;
    const lyricTop = layout.canvasHeight - layout.lyricBottom - lyricHeight;
    const stageTop = Math.max(150, layout.infoTop + 166 + 20);
    const stageBottom = lyricTop - 24;
    const verticalHalfHeight = Math.min(
      layout.assetY - stageTop,
      stageBottom - layout.assetY,
    );
    const maxCommonAssetHeight =
      verticalHalfHeight > 0 ? verticalHalfHeight * 2 : layout.assetHeight;
    const pairPlacement = calculateAssetPairPlacement(
      activeAssets.letter,
      activeAssets.object,
      {
        canvasWidth: layout.canvasWidth,
        assetHeight: layout.assetHeight,
        maxAssetHeight: maxCommonAssetHeight,
        letterScale: layout.letterScale,
        objectScale: layout.objectScale,
        assetGap: layout.assetGap ?? 96,
        assetHorizontalPadding: layout.assetHorizontalPadding ?? 80,
      },
    );
    const defaultObjectCenterY =
      layout.assetY - (layout.objectLabelFont + layout.objectLabelGap) / 2;
    const objectCenterY = activeAssets.object.includesObjectWord
      ? layout.assetY
      : defaultObjectCenterY;
    const assetStart = previewStartForLine(assetLine);
    const hideAt = assetHideAt(data.lines, assetIndex);
    const enter = clampFrameProgress(
      frame,
      Math.round(assetStart * fps),
      Math.round((assetStart + 0.38) * fps),
    );
    const fadeOut = interpolate(time, [hideAt - 0.18, hideAt], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const opacity = enter * fadeOut;
    const baseScale = 0.99 + enter * 0.01;
    const enterOffsetY = (1 - enter) * 8;
    const idleY = Math.sin(Math.max(0, time - assetStart) * 0.7) * 0.4;
    const letter = calculatePlacedAsset(
      activeAssets.letter,
      pairPlacement.letterX,
      layout.assetY,
      pairPlacement.assetHeight,
    );
    const object = calculatePlacedAsset(
      activeAssets.object,
      pairPlacement.objectX,
      objectCenterY,
      pairPlacement.assetHeight,
    );
    const sharedAssetStyle: CSSProperties = {
      position: "absolute",
      display: "block",
      pointerEvents: "none",
      filter: "drop-shadow(0 16px 18px rgba(0,0,0,0.16))",
      userSelect: "none",
      transformOrigin: "center bottom",
      zIndex: 5,
      opacity,
    };
    letterNode = (
      <Img
        src={resolveAssetSrc(activeAssets.letter.src)}
        style={{
          ...sharedAssetStyle,
          left: letter.left,
          top: letter.top,
          width: letter.width,
          height: letter.height,
          transform: `translateY(${enterOffsetY + idleY}px) scale(${baseScale})`,
        }}
      />
    );
    objectNode = (
      <Img
        src={resolveAssetSrc(activeAssets.object.src)}
        style={{
          ...sharedAssetStyle,
          left: object.left,
          top: object.top,
          width: object.width,
          height: object.height,
          transform: `translateY(${enterOffsetY + idleY - 1}px) scale(${baseScale})`,
        }}
      />
    );

    const label = titleCaseObject(activeAssets.objectName);
    if (label && !activeAssets.object.includesObjectWord) {
      objectLabelNode = (
        <div
          style={{
            position: "absolute",
            left: layout.objectX,
            top: objectCenterY + object.visibleH / 2 + layout.objectLabelGap,
            transform: `translateX(-50%) translateY(${(1 - enter) * 10 + idleY}px) scale(${0.96 + enter * 0.04})`,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: layout.objectLabelFont,
            lineHeight: 1,
            letterSpacing: 0,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            textShadow:
              "0 4px 0 rgba(255,255,255,0.72), 0 8px 16px rgba(0,0,0,0.2)",
            transformOrigin: "center top",
            zIndex: 6,
            opacity,
          }}
        >
          <span style={{ color: "#d41414" }}>{label.charAt(0)}</span>
          <span style={{ color: "#168d35" }}>{label.slice(1)}</span>
        </div>
      );
    }
  }

  return (
    <AbsoluteFill
      style={{
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <style>{FONT_IMPORT_CSS}</style>
      {backgroundSrc ? (
        <Img
          src={resolveAssetSrc(backgroundSrc)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: undefined,
            filter: hasPrebakedBackground
              ? undefined
              : `blur(${Math.min(layout.bgBlur, 3)}px) brightness(1) saturate(1.04)`,
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,248,235,0.08) 58%, rgba(255,180,75,0.05))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: layout.infoTop,
          left: layout.infoLeft,
          display: "flex",
          alignItems: "center",
          gap: 24,
          minWidth: 500,
          maxWidth: 620,
          padding: "16px 24px 16px 16px",
          borderRadius: 20,
          background: "rgba(72, 67, 56, 0.46)",
          border: "1px solid rgba(255,255,255,0.32)",
          boxShadow:
            "0 12px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.3)",
          backdropFilter: "blur(14px)",
          color: "#fff",
          fontFamily: FONT_DISPLAY,
          zIndex: 20,
        }}
      >
        {data.assets.songLogo ? (
          <Img
            src={resolveAssetSrc(data.assets.songLogo)}
            style={{
              width: 118,
              height: 118,
              objectFit: "contain",
              borderRadius: 0,
              flex: "0 0 auto",
              background: "transparent",
            }}
          />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 38,
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing: 0,
              textShadow: "0 3px 9px rgba(0,0,0,0.26)",
              ...textOverflowStyle,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 28,
              lineHeight: 1.1,
              opacity: 0.9,
              fontWeight: 700,
              letterSpacing: 0,
              textShadow: "0 2px 7px rgba(0,0,0,0.22)",
              ...textOverflowStyle,
            }}
          >
            {artist}
          </div>
        </div>
      </div>

      {data.assets.songLogo ? (
        <div
          style={{
            position: "absolute",
            top: layout.logoTop,
            right: layout.logoRight,
            width: 166,
            height: 166,
            borderRadius: 0,
            padding: 0,
            background: "transparent",
            border: 0,
            boxShadow: "none",
            transformOrigin: "center center",
            transform: undefined,
            zIndex: 18,
          }}
        >
          <Img
            src={resolveAssetSrc(data.assets.songLogo)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 0,
              display: "block",
            }}
          />
        </div>
      ) : null}

      {letterNode}
      {objectNode}
      {objectLabelNode}

      {lyricLine ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: layout.lyricBottom,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            width: layout.lyricWidth,
             height: layout.lyricHeight ?? 220,
             boxSizing: "border-box",
             overflow: "hidden",
             padding: "30px 48px",
            borderRadius: 34,
            background: "rgba(255, 237, 226, 0.92)",
            border: "2px solid rgba(235,129,62,0.82)",
            boxShadow:
              "0 10px 22px rgba(163,83,34,0.18), inset 0 0 0 2px rgba(255,255,255,0.68)",
            color: "#155da4",
            textAlign: "center",
            fontWeight: 800,
            lineHeight: 1.18,
            fontFamily: FONT_DISPLAY,
            letterSpacing: 0,
            WebkitFontSmoothing: "antialiased",
            zIndex: 32,
             opacity: 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: 24,
              border: "2px dashed rgba(229,127,82,0.52)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              width: "100%",
               transform: undefined,
              fontSize: layout.lyricFont,
            }}
          >
            {[lyricLine.line1 || lyricLine.text, lyricLine.line2 || ""]
              .filter((row) => row.trim().length > 0)
              .map((row, rowIndex) => (
                <div
                  key={`${lyricIndex}-${rowIndex}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "0 0.32em",
                    maxWidth: "100%",
                    textShadow: "0 1px 0 rgba(255,255,255,0.78)",
                  }}
                >
                  {rowWords(row).map((word, wordIndex) => {
                    const role = wordRole(
                      word,
                      lyricLine.letter ?? "",
                      lyricLine.object ?? "",
                    );
                    const color =
                      role === "letter"
                        ? "#d11414"
                        : role === "object"
                          ? "#168d35"
                          : "#185ea4";
                    return (
                      <span
                        key={`${word}-${wordIndex}`}
                        style={{ color, whiteSpace: "pre" }}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {data.assets.audio ? (
        <Audio src={resolveAssetSrc(data.assets.audio)} />
      ) : null}
    </AbsoluteFill>
  );
};
