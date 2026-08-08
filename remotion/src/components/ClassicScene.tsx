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
  const wobble = Math.sin(frame * 0.18) * (0.7 + 2.8 * pulse);
  const bands = sampleBands(analysis, t);
  const { scale, brightness } = backgroundDynamics(rms);

  // Active lyric line at the current time (Req 8.2, 10.5).
  const lineIdx = activeLineIndex(lyrics, t);
  const line = lineIdx >= 0 ? lyrics.lines[lineIdx] : null;

  // Centered learning letter for the active line. If a prebuilt/legacy artifact
  // omitted `letter`, only an isolated leading A-Z token may act as a fallback;
  // ordinary chorus/narration text must not select an asset from its first word.
  const letterKey = line ? resolveLetter(line.letter, line.text) : undefined;
  const letterSrc =
    letterKey && config.assets.letters[letterKey]
      ? config.assets.letters[letterKey]
      : undefined;
  const objectWord =
    line && letterKey ? (line.object?.trim() || resolveObjectWord(line, letterKey)) : undefined;
  const objectRevealed = line ? isObjectRevealed(line, t) : false;
  const objectSrc = objectRevealed && letterKey ? config.assets.objects?.[letterKey] : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }} data-template={config.layout.template}>
      {/* 1. Blurred background + overlay (Req 10.1, 10.2) */}
      <Background
        src={config.assets.background}
        blur={layout.bgBlur}
        scale={scale}
        brightness={brightness}
        overlayTone="light"
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
          letter={letterKey ?? ""}
          objectSrc={objectSrc}
          objectWord={objectRevealed ? objectWord : undefined}
          size={layout.letterSize}
          objectWordFontSize={layout.objectWordFontSize}
          scale={letterScale(bass, pulse)}
          glow={pulse}
          wobble={wobble}
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
          letter={letterKey}
          objectWord={objectWord}
          objectRevealed={objectRevealed}
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

/** Whether the separated object foreground/answer may be visible at time t. */
export function isObjectRevealed(
  line: { objectRevealAt?: number },
  t: number,
): boolean {
  return line.objectRevealAt === undefined || t >= line.objectRevealAt;
}

/** Resolve the A–Z key for a centered learning-letter asset. */
export function resolveLetter(
  letter: string | undefined,
  text: string,
): string | undefined {
  const provided = (letter ?? "").trim();
  if (/^[A-Za-z]$/.test(provided)) return provided.toUpperCase();

  const stripped = text.trimStart();
  const match = stripped.match(/^([A-Za-z])(?=$|\s|[.,!?;:…])/);
  return match?.[1] ? match[1].toUpperCase() : undefined;
}

/**
 * Resolve the object keyword to highlight/render from an ABC lyric line.
 *
 * Legacy fallback only. Theme-first artifacts carry an explicit `object` field;
 * this parser remains for older projects and common ABC sentence shapes ("A is for Apple", "A la Apple", "with the
 * armchair") and falls back to the first meaningful word that is not the active
 * letter.
 */
function resolveObjectWord(
  line: { text: string; line1: string; line2: string },
  letterKey?: string,
): string | undefined {
  const text = `${line.line1} ${line.line2}`.trim() || line.text;
  const pattern =
    /\b(?:is\s+for|stands\s+for|là|la|with)\s+(?:the\s+)?([\p{L}][\p{L}'-]*)/iu;
  const explicit = text.match(pattern)?.[1];
  if (explicit && normalizeToken(explicit) !== normalizeToken(letterKey ?? "")) {
    return explicit;
  }

  const words = text.match(/[\p{L}][\p{L}'-]*/gu) ?? [];
  const activeLetter = normalizeToken(letterKey ?? "");
  return words.find((word) => {
    const normalized = normalizeToken(word);
    return normalized && normalized !== activeLetter && !FILLER_WORDS.has(normalized);
  });
}

function normalizeToken(word: string): string {
  return word
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

const FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "for",
  "here",
  "is",
  "la",
  "là",
  "or",
  "stands",
  "the",
  "to",
  "with",
]);
