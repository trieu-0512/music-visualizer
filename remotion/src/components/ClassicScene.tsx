/**
 * Shared layer stack for the Classic template family.
 *
 * Per the design, the landscape and portrait Classic templates "differ only in
 * placement constants and which template id is selected", so the full layer
 * composition lives here once and each orientation supplies a {@link ClassicLayout}.
 *
 * The scene is a pure function of `(config, lyrics, analysis, frame)`: it reads
 * the current frame via Remotion hooks, derives every reactive scalar through
 * the pure selectors in `../selectors.ts`, and hands those values to purely
 * presentational layer components. The layers, in z-order:
 *
 *   1. Blurred Background_Asset + overlay, RMS-driven zoom/brightness (Req 10.1, 10.2)
 *   2. Left & right audio bars from band energy + volume               (Req 10.9)
 *   3. Centered Letter_Asset for the active line, beat/bass scale+glow  (Req 10.3, 10.4)
 *   4. Top-left info box (song logo + names)                           (Req 10.7)
 *   5. Top-right circular channel logo                                 (Req 10.8)
 *   6. Bottom lyric box with karaoke word coloring                     (Req 10.5, 10.6)
 *   7. Preview audio                                                   (Req 8.x preview)
 */
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from "remotion";
import type { TemplateProps } from "../templates/types.js";
import {
  activeLineIndex,
  backgroundDynamics,
  beatPulse,
  letterScale,
  litWordCount,
  sampleBands,
  sampleSeries,
} from "../selectors.js";
import { resolveAssetSrc } from "./assets.js";
import type { ClassicLayout } from "./layout.js";
import { Background } from "./Background.js";
import { CenterLetter } from "./CenterLetter.js";
import { AudioBars } from "./AudioBars.js";
import { InfoBox } from "./InfoBox.js";
import { ChannelLogo } from "./ChannelLogo.js";
import { LyricBox } from "./LyricBox.js";

/** Props for {@link ClassicScene}: the template artifacts plus a layout. */
export interface ClassicSceneProps extends TemplateProps {
  /** Per-orientation placement constants (landscape vs portrait). */
  layout: ClassicLayout;
}

export const ClassicScene: React.FC<ClassicSceneProps> = ({
  config,
  lyrics,
  analysis,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Reactive scalars — all derived by the pure selectors (Req 8.3, 10.2/10.4/10.9).
  const rms = sampleSeries(analysis.rms, analysis.interval, t);
  const bass = sampleSeries(analysis.bass, analysis.interval, t);
  const pulse = beatPulse(analysis.beats, t, layout.beatWindow);
  const bands = sampleBands(analysis, t);
  const { scale, brightness } = backgroundDynamics(rms);

  // Active lyric line at the current time (Req 8.2, 10.5).
  const lineIdx = activeLineIndex(lyrics, t);
  const line = lineIdx >= 0 ? lyrics.lines[lineIdx] : null;

  // Centered letter for the active line — fall back to the line's first
  // alphabetic character when the aligner left `letter` unset.
  const letterKey = line ? resolveLetter(line.letter, line.text) : undefined;
  const letterSrc =
    letterKey && config.assets.letters[letterKey]
      ? config.assets.letters[letterKey]
      : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }} data-template={config.layout.template}>
      {/* 1. Blurred background + overlay (Req 10.1, 10.2) */}
      <Background
        src={config.assets.background}
        blur={layout.bgBlur}
        scale={scale}
        brightness={brightness}
        overlay
      />

      {/* 2. Left & right audio bars (Req 10.9) */}
      {config.layout.bars.left && (
        <AudioBars
          side="left"
          rms={rms}
          bands={bands}
          count={layout.bars.count}
          maxLength={layout.bars.maxLength}
          thickness={layout.bars.thickness}
          gap={layout.bars.gap}
          edgeInset={layout.bars.edgeInset}
        />
      )}
      {config.layout.bars.right && (
        <AudioBars
          side="right"
          rms={rms}
          bands={bands}
          count={layout.bars.count}
          maxLength={layout.bars.maxLength}
          thickness={layout.bars.thickness}
          gap={layout.bars.gap}
          edgeInset={layout.bars.edgeInset}
        />
      )}

      {/* 3. Centered letter with beat/bass scale + glow (Req 10.3, 10.4) */}
      {letterSrc && (
        <CenterLetter
          src={letterSrc}
          size={layout.letterSize}
          scale={letterScale(bass, pulse)}
          glow={pulse}
          offsetY={layout.letterOffsetY}
        />
      )}

      {/* 4. Top-left info box (Req 10.7) */}
      <InfoBox
        logo={config.assets.songLogo}
        songName={config.metadata.songName}
        singerName={config.metadata.singerName}
        margin={layout.infoBox.margin}
        logoSize={layout.infoBox.logoSize}
        songFontSize={layout.infoBox.songFontSize}
        singerFontSize={layout.infoBox.singerFontSize}
        padding={layout.infoBox.padding}
      />

      {/* 5. Top-right circular channel logo (Req 10.8) */}
      <ChannelLogo
        src={config.assets.channelLogo}
        margin={layout.channelLogo.margin}
        size={layout.channelLogo.size}
      />

      {/* 6. Bottom lyric box with karaoke coloring (Req 10.5, 10.6) */}
      {line && (
        <LyricBox
          line1={line.line1}
          line2={line.line2}
          litWords={litWordCount(line, t)}
          maxLines={config.layout.lyricBox.maxLines}
          marginBottom={layout.lyricBox.marginBottom}
          maxWidth={layout.lyricBox.maxWidth}
          fontSize={layout.lyricBox.fontSize}
          lineGap={layout.lyricBox.lineGap}
          padding={layout.lyricBox.padding}
        />
      )}

      {/* 7. Preview audio (Req 8 preview / render mux source) */}
      <Audio src={resolveAssetSrc(config.assets.audio)} />
    </AbsoluteFill>
  );
};

/**
 * Resolve the A–Z letter key for the centered Letter_Asset.
 *
 * Prefers the aligner-provided `letter`; otherwise falls back to the first
 * alphabetic character of the line text. Returns `undefined` when neither
 * yields a usable A–Z key (e.g. a non-Latin or empty line).
 */
function resolveLetter(letter: string | undefined, text: string): string | undefined {
  const candidate = (letter ?? "").trim().charAt(0) || firstAlpha(text);
  if (!candidate) return undefined;
  const upper = candidate.toUpperCase();
  return upper >= "A" && upper <= "Z" ? upper : undefined;
}

/** First ASCII-letter character of `text`, or `""` when none exists. */
function firstAlpha(text: string): string {
  const match = text.match(/[A-Za-z]/);
  return match ? match[0] : "";
}
