// Feature: music-visualizer, Property 9: Active lyric line selection matches
// playback time. For any `lyrics.json` and any playback time t, the selected
// active line is one whose `[start, end]` interval contains t, and no line is
// selected when no interval contains t. (When several lines contain t — e.g. at
// a shared boundary — the design selects the first such line, matching the
// `findIndex` semantics of `activeLineIndex`.)
//
// Validates: Requirements 8.2
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { LyricLine, LyricsJson } from "@music-visualizer/shared";

import { activeLineIndex } from "../src/selectors.js";

// --- Arbitraries -------------------------------------------------------------

/** One segment: a non-negative gap before the line and a non-negative duration. */
const segmentArb = fc.record({
  gap: fc.double({ min: 0, max: 5, noNaN: true }),
  dur: fc.double({ min: 0, max: 5, noNaN: true }),
  text: fc.string({ maxLength: 12 }),
});

/**
 * Ascending lyric lines built from a base start time plus a sequence of
 * (gap, duration) segments. The running cursor guarantees `start <= end` for
 * every line and ascending `start` across lines (Req 4.6, 4.7). A `gap > 0`
 * leaves an explicit hole between lines; a `gap == 0` makes adjacent lines share
 * a boundary instant, exercising the "first matching line" tie-break. An empty
 * segment list yields an empty `lines` array.
 */
const linesArb: fc.Arbitrary<LyricLine[]> = fc
  .tuple(
    fc.double({ min: 0, max: 10, noNaN: true }),
    fc.array(segmentArb, { maxLength: 8 }),
  )
  .map(([base, segments]) => {
    let cursor = base;
    return segments.map(({ gap, dur, text }) => {
      const start = cursor + gap;
      const end = start + dur;
      cursor = end;
      return { start, end, text, line1: text, line2: "" } satisfies LyricLine;
    });
  });

/**
 * Playback times targeted at the interesting regions for a given set of lines:
 * a broad random sweep that reaches before the first line and after the last
 * line (and through any gaps), exact line boundaries and midpoints, and points
 * just outside each line's interval. Falls back to a plain random time when
 * there are no lines.
 */
function timeArbFor(lines: LyricLine[]): fc.Arbitrary<number> {
  if (lines.length === 0) {
    return fc.double({ min: -10, max: 20, noNaN: true });
  }
  const minStart = lines[0]!.start;
  const maxEnd = Math.max(...lines.map((l) => l.end));

  const fromLine = fc
    .integer({ min: 0, max: lines.length - 1 })
    .chain((i) => {
      const l = lines[i]!;
      return fc.constantFrom(
        l.start, // inclusive lower bound
        l.end, // inclusive upper bound
        (l.start + l.end) / 2, // inside
        l.start - 0.001, // just before
        l.end + 0.001, // just after
      );
    });

  return fc.oneof(
    // Sweep the whole timeline plus margins on both ends, covering gaps,
    // before-first, and after-last regions.
    fc.double({ min: minStart - 10, max: maxEnd + 10, noNaN: true }),
    fromLine,
    fc.constant(minStart - 1), // strictly before all lines
    fc.constant(maxEnd + 1), // strictly after all lines
  );
}

interface Case {
  lyrics: LyricsJson;
  t: number;
}

const caseArb: fc.Arbitrary<Case> = linesArb.chain((lines) =>
  fc.record({
    lyrics: fc.record({
      version: fc.constant(1 as const),
      source: fc.constantFrom("transcriber", "original+transcriber"),
      lines: fc.constant(lines),
    }),
    t: timeArbFor(lines),
  }),
);

// --- Property ----------------------------------------------------------------

describe("Property 9: active lyric line selection matches playback time (Req 8.2)", () => {
  it("selects a line whose [start, end] contains t, and -1 exactly when none does", () => {
    fc.assert(
      fc.property(caseArb, ({ lyrics, t }) => {
        const idx = activeLineIndex(lyrics, t);

        // Oracle: indices of every line whose inclusive interval contains t.
        const containing = lyrics.lines
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => t >= l.start && t <= l.end)
          .map(({ i }) => i);

        if (containing.length === 0) {
          // No interval contains t => no line is selected.
          expect(idx).toBe(-1);
        } else {
          // A line is selected, it is the first matching line, and it truly
          // contains t.
          expect(idx).toBe(containing[0]);
          const selected = lyrics.lines[idx]!;
          expect(t >= selected.start && t <= selected.end).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });
});
