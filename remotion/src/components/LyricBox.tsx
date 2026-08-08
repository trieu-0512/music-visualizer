/**
 * Bottom lyric box with semantic word coloring (Req 10.5, 10.6).
 *
 * Shows one or two display rows (`line1` / `line2`) of the active lyric line.
 * Words are colored by role: normal lyrics share one readable color, the active
 * letter uses a highlight color, and the derived object keyword uses a second
 * highlight color. `litWords` still controls subtle opacity so word timing stays
 * visible without turning every lyric into a rainbow.
 */

/** Props for the {@link LyricBox} layer. */
export interface LyricBoxProps {
  /** Display row 1 (Req 10.5). */
  line1: string;
  /** Display row 2, may be `""` for a single-line lyric (Req 10.5). */
  line2: string;
  /** Count of lit words from `litWordCount`; may be `Infinity` (Req 10.6). */
  litWords: number;
  /** Active A-Z key, used to color the letter keyword. */
  letter?: string;
  /** Derived object keyword, used to color object words. */
  objectWord?: string;
  /** False during a retrieval gap so the lyric box does not visually spoil the answer. */
  objectRevealed?: boolean;
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

const NORMAL_COLOR = "#1f4e72";
const LETTER_COLOR = "#d11414";
const OBJECT_COLOR = "#168d35";

function normalizeWord(word: string): string {
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase();
}

function wordRole(word: string, letter?: string, objectWord?: string): "letter" | "object" | "normal" {
  const normalized = normalizeWord(word);
  if (!normalized) return "normal";
  const normalizedLetter = normalizeWord(letter ?? "");
  if (normalizedLetter && normalized === normalizedLetter) return "letter";
  const objectTokens = (objectWord ?? "")
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
  if (objectTokens.includes(normalized)) return "object";
  return "normal";
}

function roleColor(role: "letter" | "object" | "normal"): string {
  if (role === "letter") return LETTER_COLOR;
  if (role === "object") return OBJECT_COLOR;
  return NORMAL_COLOR;
}

/** Render one display row, coloring words lit when their global index < litWords. */
function Row({
  words,
  startIndex,
  litWords,
  letter,
  objectWord,
  objectRevealed,
  fontSize,
}: {
  words: string[];
  startIndex: number;
  litWords: number;
  letter?: string;
  objectWord?: string;
  objectRevealed: boolean;
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
        fontWeight: 800,
        lineHeight: 1.18,
        textShadow: "0 1px 0 rgba(255,255,255,0.72)",
      }}
    >
      {words.map((word, i) => {
        const globalIndex = startIndex + i;
        const lit = globalIndex < litWords;
        const role = wordRole(word, letter, objectWord);
        return (
          <span
            // Word positions are stable within a frame's row; index keys are fine.
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            data-word={globalIndex}
            data-lit={lit}
            data-role={role}
            style={{
              color: roleColor(role),
              opacity: lit ? 1 : 0.68,
              fontWeight: role === "normal" ? 800 : 900,
              transform: role === "normal" ? undefined : "translateY(-1px)",
            }}
          >
            {role === "object" && !objectRevealed ? "____" : word}
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
  letter,
  objectWord,
  objectRevealed = true,
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
        borderRadius: 34,
        background: "rgba(255,237,226,0.9)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "2px solid rgba(235,129,62,0.82)",
        boxShadow: "0 10px 22px rgba(163,83,34,0.18), inset 0 0 0 2px rgba(255,255,255,0.68)",
        fontFamily: "Arial, Helvetica, sans-serif",
        textAlign: "center",
        color: NORMAL_COLOR,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 12,
          borderRadius: 24,
          border: "2px dashed rgba(229,127,82,0.48)",
          pointerEvents: "none",
        }}
      />
      {row1.length > 0 && (
        <Row
          words={row1}
          startIndex={0}
          litWords={litWords}
          letter={letter}
          objectWord={objectWord}
          objectRevealed={objectRevealed}
          fontSize={fontSize}
        />
      )}
      {row2.length > 0 && (
        <Row
          words={row2}
          startIndex={row1.length}
          litWords={litWords}
          letter={letter}
          objectWord={objectWord}
          objectRevealed={objectRevealed}
          fontSize={fontSize}
        />
      )}
    </div>
  );
};
