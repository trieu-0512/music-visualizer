/**
 * Types for the standardized lyric artifact `lyrics.json` (Req 4, Req 15.4).
 *
 * Produced by the Lyric_Aligner and consumed by the Config_Builder, the
 * Render_Engine, and the SRT exporter. The matching JSON Schema lives at
 * `shared/src/schema/lyrics.schema.json` so the Python worker validates
 * against the identical contract.
 */

/** Per-word start/end timing within a {@link LyricLine} (Req 4.5). */
export interface WordTiming {
  text: string;
  /** Seconds, `>= 0`. */
  start: number;
  /** Seconds, `>= start`. */
  end: number;
}

/** A single displayed lyric line with timing and bottom-box display rows. */
export interface LyricLine {
  /** Seconds, `>= 0`. */
  start: number;
  /** Seconds, `>= start` (Req 4.7). */
  end: number;
  /** Full line text. */
  text: string;
  /** Bottom box, display row 1 (Req 4.4). */
  line1: string;
  /** Bottom box, display row 2 (`""` when single line) (Req 4.4). */
  line2: string;
  /** Optional word-level timing, ordered by ascending start (Req 4.5). */
  words?: WordTiming[];
  /** Resolved A–Z key for the centered Letter_Asset. */
  letter?: string;
}

/** The `lyrics.json` artifact (Req 4.3, 4.6). */
export interface LyricsJson {
  version: 1;
  /** Whether display text came from the transcriber alone or original lyrics. */
  source: "transcriber" | "original+transcriber";
  /** Lyric lines ordered by ascending start (Req 4.6). */
  lines: LyricLine[];
}
