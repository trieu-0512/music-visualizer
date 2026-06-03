/**
 * Bottom lyric box with karaoke word coloring (Req 10.5, 10.6).
 *
 * Shows one or two display rows (`line1` / `line2`) of the active lyric line.
 * Words are colored progressively as `litWords` advances: the first `litWords`
 * words (counted across `line1` then `line2`) are "lit", the rest are dim. The
 * `litWords` value comes from the `litWordCount` selector and may be `Infinity`
 * (whole line lit, e.g. when the line has no word-level timing), which lights
 * every word.
 */

/** Props for the {@link LyricBox} layer. */
export interface LyricBoxProps {
  /** Display row 1 (Req 10.5). */
  line1: string;
  /** Display row 2, may be `""` for a single-line lyric (Req 10.5). */
  line2: string;
  /** Count of lit words from `litWordCount`; may be `Infinity` (Req 10.6). */
  litWords: number;
  /** Max display rows from `layout.lyricBox.maxLines`. */
  maxLines: 1 | 2;
  /** Distance from the bottom canvas edge in px. */
  marginBottom: number;
  /** Max box width in px. */
  maxWidth: number;
  /** Lyric font size in px. */
  fontSize: number;
  /** Vertical gap between rows in px. */
  lineGap: number;
  /** Inner padding of the box in px. */
  padding: number;
}

/** Split a display row into whitespace-delimited word tokens. */
function tokenize(row: string): string[] {
  const trimmed = row.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

const LIT_COLOR = "#ffe14d";
const DIM_COLOR = "rgba(255,255,255,0.7)";

/** Render one display row, coloring words lit when their global index < litWords. */
function Row({
  words,
  startIndex,
  litWords,
  fontSize,
}: {
  words: string[];
  startIndex: number;
  litWords: number;
  fontSize: number;
}): React.ReactElement {
  return (
    <div
      data-lyric-row
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 0.32em",
        fontSize,
        fontWeight: 700,
        lineHeight: 1.15,
        textShadow: "0 2px 8px rgba(0,0,0,0.7)",
      }}
    >
      {words.map((word, i) => {
        const globalIndex = startIndex + i;
        const lit = globalIndex < litWords;
        return (
          <span
            // Word positions are stable within a frame's row; index keys are fine.
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            data-word={globalIndex}
            data-lit={lit}
            style={{ color: lit ? LIT_COLOR : DIM_COLOR }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export const LyricBox: React.FC<LyricBoxProps> = ({
  line1,
  line2,
  litWords,
  maxLines,
  marginBottom,
  maxWidth,
  fontSize,
  lineGap,
  padding,
}) => {
  const row1 = tokenize(line1);
  const row2 = maxLines === 2 ? tokenize(line2) : [];

  // Nothing to display — render no box so an empty/instrumental line is blank.
  if (row1.length === 0 && row2.length === 0) return null;

  return (
    <div
      data-layer="lyric-box"
      style={{
        position: "absolute",
        bottom: marginBottom,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: lineGap,
        padding,
        borderRadius: 18,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        fontFamily: "Arial, Helvetica, sans-serif",
        textAlign: "center",
      }}
    >
      {row1.length > 0 && (
        <Row words={row1} startIndex={0} litWords={litWords} fontSize={fontSize} />
      )}
      {row2.length > 0 && (
        <Row
          words={row2}
          startIndex={row1.length}
          litWords={litWords}
          fontSize={fontSize}
        />
      )}
    </div>
  );
};
