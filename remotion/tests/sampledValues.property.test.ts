// Feature: music-visualizer, Property 10: Sampled and derived reactive values
// are always in range. For any analysis series, positive interval, and time
// t >= 0, `sampleSeries` returns the element at `clamp(floor(t / interval))`
// and never indexes out of range; and for any analysis sample, every computed
// audio-bar height lies within `[0, maxHeight]`. This file also exercises the
// related sampling/derivation surface (`sampleBands`) that feeds the audio bars
// with adversarial values, varied intervals, and any playback time (including
// negative and beyond the end of the series).
//
// Validates: Requirements 8.3, 10.9
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { AudioAnalysisJson } from "@music-visualizer/shared";

import { barHeights, sampleBands, sampleSeries } from "../src/selectors.js";

const NUM_RUNS = 200;

// --- Arbitraries --------------------------------------------------------------

/**
 * A finite numeric series value. Spans well outside the normalized `0..1`
 * range (and includes negatives) so the in-range guarantees are exercised
 * against adversarial source data, not just well-formed analysis output.
 */
const seriesValueArb = fc.double({ min: -1_000, max: 1_000, noNaN: true });

/** A finite numeric series (possibly empty) of adversarial values. */
const seriesArb = fc.array(seriesValueArb, { maxLength: 64 });

/** A strictly positive interval, as required by the core Property 10 claim. */
const positiveIntervalArb = fc.double({
  min: 1e-6,
  max: 1_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Any finite interval, including zero and negatives. Used to confirm sampling
 * stays in range even for malformed (non-positive) intervals.
 */
const anyIntervalArb = fc.double({
  min: -1_000,
  max: 1_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** A non-negative playback time `t >= 0` (the core property domain). */
const nonNegativeTimeArb = fc.double({
  min: 0,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Any finite playback time, including negative and far beyond the series end. */
const anyTimeArb = fc.double({
  min: -100_000,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** A per-interval band vector (frequency-band energies), inner length 0..8. */
const bandVectorArb = fc.array(seriesValueArb, { maxLength: 8 });

/** Build a minimal `AudioAnalysisJson` whose bands/interval drive sampling. */
function makeAnalysis(bands: number[][], interval: number): AudioAnalysisJson {
  return {
    version: 1,
    duration: 0,
    interval,
    sampleRate: 44_100,
    rms: [],
    bass: [],
    bands,
    bandCount: bands[0]?.length ?? 0,
    beats: [],
  };
}

/** Mirror of the index formula stated by Property 10: `clamp(floor(t/interval))`. */
function expectedIndex(length: number, interval: number, t: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(t / interval)));
}

describe("Property 10: Sampled and derived reactive values are always in range", () => {
  it("sampleSeries returns the element at clamp(floor(t/interval)) for positive interval and t >= 0", () => {
    fc.assert(
      fc.property(
        fc.array(seriesValueArb, { minLength: 1, maxLength: 64 }),
        positiveIntervalArb,
        nonNegativeTimeArb,
        (series, interval, t) => {
          const i = expectedIndex(series.length, interval, t);
          // Index never escapes the valid range.
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThanOrEqual(series.length - 1);
          // The sampled value is exactly the element at that index.
          expect(Object.is(sampleSeries(series, interval, t), series[i])).toBe(
            true,
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("sampleSeries never returns an out-of-range or undefined value for any t/interval", () => {
    fc.assert(
      fc.property(seriesArb, anyIntervalArb, anyTimeArb, (series, interval, t) => {
        const result = sampleSeries(series, interval, t);
        expect(typeof result).toBe("number");
        if (series.length === 0) {
          // Empty series has no sample; the contract returns 0.
          expect(result).toBe(0);
        } else {
          // The result is always a member of the source series (never indexes
          // out of bounds, never undefined), even for negative/zero intervals
          // and times before 0 or past the end.
          expect(series.some((v) => Object.is(v, result))).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("sampleBands returns a valid band vector from the source for any t/interval", () => {
    fc.assert(
      fc.property(
        fc.array(bandVectorArb, { maxLength: 64 }),
        anyIntervalArb,
        anyTimeArb,
        (bands, interval, t) => {
          const analysis = makeAnalysis(bands, interval);
          const result = sampleBands(analysis, t);
          expect(Array.isArray(result)).toBe(true);
          if (bands.length === 0) {
            // No bands -> empty vector (no out-of-range access).
            expect(result).toEqual([]);
          } else {
            // The result is exactly one of the source band vectors.
            expect(bands.includes(result)).toBe(true);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("sampleBands returns the band vector at clamp(floor(t/interval)) for positive interval and t >= 0", () => {
    fc.assert(
      fc.property(
        fc.array(bandVectorArb, { minLength: 1, maxLength: 64 }),
        positiveIntervalArb,
        nonNegativeTimeArb,
        (bands, interval, t) => {
          const analysis = makeAnalysis(bands, interval);
          const i = expectedIndex(bands.length, interval, t);
          expect(sampleBands(analysis, t)).toBe(bands[i]);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("barHeights keeps every derived bar height within [0, maxHeight]", () => {
    fc.assert(
      fc.property(
        fc.array(seriesValueArb, { maxLength: 32 }),
        seriesValueArb,
        fc.double({ min: 0, max: 4_000, noNaN: true, noDefaultInfinity: true }),
        (bands, volume, maxHeight) => {
          const heights = barHeights(bands, volume, maxHeight);
          // One height per band, no extra/dropped entries.
          expect(heights).toHaveLength(bands.length);
          for (const h of heights) {
            expect(Number.isFinite(h)).toBe(true);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThanOrEqual(maxHeight);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("barHeights clamps a negative maxHeight to produce only zero heights", () => {
    fc.assert(
      fc.property(
        fc.array(seriesValueArb, { maxLength: 32 }),
        seriesValueArb,
        fc.double({ min: -4_000, max: -1e-6, noNaN: true, noDefaultInfinity: true }),
        (bands, volume, maxHeight) => {
          const heights = barHeights(bands, volume, maxHeight);
          expect(heights).toHaveLength(bands.length);
          for (const h of heights) {
            // maxHeight is clamped to 0, so every height collapses to 0 and
            // still lies within the (empty-collapsed) [0, max(0, maxHeight)].
            expect(h).toBe(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
