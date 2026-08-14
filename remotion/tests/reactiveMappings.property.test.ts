import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  backgroundDynamics,
  beatPulse,
  letterScale,
} from "../src/selectors.js";

/**
 * Feature: music-visualizer, Property 11: Reactive visual mappings are bounded
 * and monotonic.
 *
 * For any RMS value in [0,1], background scale and brightness fall within their
 * configured bounds and are monotonically non-decreasing in RMS; and for any
 * beat list and time t, `beatPulse` lies in [0,1], equals 0 when no beat is
 * within the window, and the letter scale derived from bass/pulse stays within
 * its configured bounds and is non-decreasing in bass.
 *
 * Validates: Requirements 10.2, 10.4
 *
 * Configured bounds (design `selectors.ts`):
 *   - backgroundDynamics.scale      in [1, 1]
 *   - backgroundDynamics.brightness in [1.0, 1.0]
 *   - letterScale                   in [1, 1.08]
 *   - beatPulse                     in [0, 1]
 */

const NUM_RUNS = 100;

// Tolerance for floating-point comparisons against the analytic bounds.
const EPS = 1e-9;

const SCALE_MIN = 1;
const SCALE_MAX = 1;
const BRIGHTNESS_MIN = 1;
const BRIGHTNESS_MAX = 1.0;
const LETTER_MIN = 1;
const LETTER_MAX = 1.08;

/**
 * Finite doubles spanning well below 0 and well above 1, so each generated
 * value exercises both the in-range `[0, 1]` case and the out-of-range case
 * (negative and `> 1`) that the selectors must clamp.
 */
const anyValue = fc.double({
  min: -100,
  max: 100,
  noNaN: true,
  noDefaultInfinity: true,
});

/** An ordered pair `[lo, hi]` with `lo <= hi`, for monotonicity checks. */
const orderedPair = fc
  .tuple(anyValue, anyValue)
  .map(([a, b]): [number, number] => (a <= b ? [a, b] : [b, a]));

/** A list of finite beat timestamps (possibly empty, possibly unsorted). */
const beatsArb = fc.array(anyValue, { minLength: 0, maxLength: 12 });

describe("Property 11: Reactive visual mappings are bounded and monotonic (Req 10.2, 10.4)", () => {
  it("backgroundDynamics stays within its scale/brightness bounds for any rms", () => {
    fc.assert(
      fc.property(anyValue, (rms) => {
        const { scale, brightness } = backgroundDynamics(rms);
        expect(scale).toBeGreaterThanOrEqual(SCALE_MIN - EPS);
        expect(scale).toBeLessThanOrEqual(SCALE_MAX + EPS);
        expect(brightness).toBeGreaterThanOrEqual(BRIGHTNESS_MIN - EPS);
        expect(brightness).toBeLessThanOrEqual(BRIGHTNESS_MAX + EPS);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("backgroundDynamics is monotonically non-decreasing in rms", () => {
    fc.assert(
      fc.property(orderedPair, ([lo, hi]) => {
        const a = backgroundDynamics(lo);
        const b = backgroundDynamics(hi);
        // lo <= hi must never produce a smaller scale or brightness.
        expect(b.scale).toBeGreaterThanOrEqual(a.scale - EPS);
        expect(b.brightness).toBeGreaterThanOrEqual(a.brightness - EPS);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("letterScale stays within [1, 1.4] for any bass/pulse", () => {
    fc.assert(
      fc.property(anyValue, anyValue, (bass, pulse) => {
        const scale = letterScale(bass, pulse);
        expect(scale).toBeGreaterThanOrEqual(LETTER_MIN - EPS);
        expect(scale).toBeLessThanOrEqual(LETTER_MAX + EPS);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("letterScale is non-decreasing in bass (pulse held fixed)", () => {
    fc.assert(
      fc.property(orderedPair, anyValue, ([bassLo, bassHi], pulse) => {
        expect(letterScale(bassHi, pulse)).toBeGreaterThanOrEqual(
          letterScale(bassLo, pulse) - EPS,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("letterScale is non-decreasing in pulse (bass held fixed)", () => {
    fc.assert(
      fc.property(orderedPair, anyValue, ([pulseLo, pulseHi], bass) => {
        expect(letterScale(bass, pulseHi)).toBeGreaterThanOrEqual(
          letterScale(bass, pulseLo) - EPS,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("beatPulse lies in [0,1] and is 0 when no beat is within the window", () => {
    fc.assert(
      fc.property(beatsArb, anyValue, anyValue, (beats, t, window) => {
        const pulse = beatPulse(beats, t, window);

        // Bounded in [0, 1] for any beats/time/window (including window <= 0).
        expect(pulse).toBeGreaterThanOrEqual(0);
        expect(pulse).toBeLessThanOrEqual(1 + EPS);

        // A non-positive window or empty beat list yields no pulse.
        if (window <= 0 || beats.length === 0) {
          expect(pulse).toBe(0);
          return;
        }

        // "No beat within the window" <=> the nearest beat is >= window away.
        const nearestDist = Math.min(...beats.map((b) => Math.abs(t - b)));
        if (nearestDist >= window) {
          expect(pulse).toBe(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
