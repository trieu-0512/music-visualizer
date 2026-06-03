// Feature: music-visualizer, Property 12: Karaoke word coloring is monotonic
// and correct. For any lyric line with word timing and any time t, the lit-word
// count equals the number of words whose start time is <= t, the count is
// bounded by [0, words.length], and it is monotonically non-decreasing as t
// increases. For a line without word timing the whole line lights up once it
// begins: the count is 0 before line.start and Infinity at/after line.start
// (also monotonic, since 0 <= Infinity).
//
// Validates: Requirements 10.6
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { LyricLine, WordTiming } from "@music-visualizer/shared";
import { litWordCount } from "../src/selectors.js";

const NUM_RUNS = 200;

/** Finite playback time `>= 0` seconds. */
const timeArb = fc.double({ min: 0, max: 600, noNaN: true });

/**
 * Word timings ordered by ascending start (as guaranteed by the aligner and
 * the `lyrics.json` schema). Each word's `end` is `start + 0.5` so the records
 * are well-formed (`end >= start`); only `start` affects `litWordCount`.
 */
const wordsArb = fc
  .array(fc.double({ min: 0, max: 600, noNaN: true }), {
    minLength: 0,
    maxLength: 30,
  })
  .map((starts) =>
    [...starts]
      .sort((a, b) => a - b)
      .map((s, i): WordTiming => ({ text: `w${i}`, start: s, end: s + 0.5 })),
  );

/** A LyricLine that carries word-level timing. */
const timedLineArb: fc.Arbitrary<LyricLine> = fc
  .record({ start: fc.double({ min: 0, max: 600, noNaN: true }), words: wordsArb })
  .map(({ start, words }): LyricLine => {
    // Keep the line interval consistent with its words when present.
    const lineStart = words.length ? Math.min(start, words[0].start) : start;
    const lastWord = words.length ? words[words.length - 1].end : lineStart;
    return {
      start: lineStart,
      end: Math.max(lineStart, lastWord),
      text: words.map((w) => w.text).join(" "),
      line1: words.map((w) => w.text).join(" "),
      line2: "",
      words,
    };
  });

/** A LyricLine with no word timing (whole-line lighting). */
const untimedLineArb: fc.Arbitrary<LyricLine> = fc
  .double({ min: 0, max: 600, noNaN: true })
  .map((start): LyricLine => ({
    start,
    end: start + 5,
    text: "whole line",
    line1: "whole line",
    line2: "",
  }));

describe("Feature: music-visualizer, Property 12: Karaoke word coloring is monotonic and correct", () => {
  it("lit-word count equals words with start <= t and is bounded by [0, words.length]", () => {
    fc.assert(
      fc.property(timedLineArb, timeArb, (line, t) => {
        const words = line.words ?? [];
        // litWordCount lights a word when t >= w.start, i.e. w.start <= t.
        const expected = words.filter((w) => w.start <= t).length;
        const count = litWordCount(line, t);
        expect(count).toBe(expected);
        expect(count).toBeGreaterThanOrEqual(0);
        expect(count).toBeLessThanOrEqual(words.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("is monotonically non-decreasing in t for a line with word timing", () => {
    fc.assert(
      fc.property(timedLineArb, timeArb, timeArb, (line, a, b) => {
        const t1 = Math.min(a, b);
        const t2 = Math.max(a, b);
        expect(litWordCount(line, t1)).toBeLessThanOrEqual(litWordCount(line, t2));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("is 0 strictly before the first word and 0 for a line with no words", () => {
    fc.assert(
      fc.property(timedLineArb, (line) => {
        const words = line.words ?? [];
        if (words.length === 0) {
          // No words: count is always 0 regardless of t.
          expect(litWordCount(line, 0)).toBe(0);
          expect(litWordCount(line, 1_000)).toBe(0);
          return;
        }
        const firstStart = words[0].start;
        // Strictly before the first word start, nothing is lit.
        const before = Math.max(0, firstStart - 1);
        expect(litWordCount(line, before)).toBe(
          words.filter((w) => w.start <= before).length,
        );
        // At the first word's start it becomes lit (count >= 1).
        expect(litWordCount(line, firstStart)).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("lights the whole line (Infinity) at/after start and 0 before for untimed lines, monotonically", () => {
    fc.assert(
      fc.property(untimedLineArb, timeArb, timeArb, (line, a, b) => {
        const t1 = Math.min(a, b);
        const t2 = Math.max(a, b);
        // Before start: 0; at/after start: Infinity.
        for (const t of [t1, t2]) {
          const count = litWordCount(line, t);
          expect(count).toBe(t >= line.start ? Infinity : 0);
        }
        // Monotonic non-decreasing (0 <= 0, 0 <= Infinity, Infinity <= Infinity).
        expect(litWordCount(line, t1)).toBeLessThanOrEqual(litWordCount(line, t2));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
