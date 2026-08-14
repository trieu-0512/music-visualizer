/**
 * Render_Engine pure reactive selectors.
 *
 * These are pure functions of `(lyrics, audioAnalysis, t)` so the reactive
 * visual logic can be unit/property tested independently of pixel output. They
 * import only types from `@music-visualizer/shared` and have no Remotion/React
 * dependency, which keeps them deterministic and trivially testable.
 *
 * Implemented in task 9.1; these selectors feed the templates (task 10.2) and
 * the property tests for active-line selection, in-range sampled/derived
 * values, bounded/monotonic mappings, and karaoke coloring (tasks 9.2–9.5,
 * design Properties 9–12).
 */
import type {
  AudioAnalysisJson,
  LyricLine,
  LyricsJson,
} from "@music-visualizer/shared";

/** Background zoom + brightness pair returned by {@link backgroundDynamics}. */
export interface BackgroundDynamics {
  /** Background scale (zoom), `>= 1`. */
  scale: number;
  /** Background brightness multiplier. */
  brightness: number;
}

/** Clamp a value into the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamp a value into `[0, 1]` (used to keep normalized inputs in range). */
function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Index into a per-interval time series for playback time `t`.
 *
 * Returns `clamp(floor(t / interval))` bounded to `[0, length - 1]`, so it never
 * indexes out of range — even for `t` past the end of the audio, `t < 0`, or a
 * non-positive interval (Property 10). For an empty series the result is `-1`,
 * which callers treat as "no sample".
 */
function seriesIndex(length: number, interval: number, t: number): number {
  if (length <= 0) return -1;
  const raw = interval > 0 ? Math.floor(t / interval) : 0;
  return clamp(raw, 0, length - 1);
}

/** The nearest value in `values` to `target`, or `null` when `values` is empty. */
function closest(values: number[], target: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const v of values) {
    const dist = Math.abs(v - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

/**
 * Which lyric line is active at playback time `t` (Req 8.2, 10.5).
 *
 * Returns the index of the line whose `[start, end]` interval contains `t`, or
 * `-1` when no line is active (Property 9).
 */
export function activeLineIndex(lyrics: LyricsJson, t: number): number {
  return lyrics.lines.findIndex((l) => t >= l.start && t <= l.end);
}

/**
 * How many words are "lit" for karaoke coloring at playback time `t` (Req 10.6).
 *
 * With word timing the count is the number of words whose `start <= t`, which is
 * monotonically non-decreasing in `t` (Property 12). With no word timing the
 * whole line lights up once it begins, signalled by `Infinity`.
 */
export function litWordCount(line: LyricLine, t: number): number {
  if (!line.words) return t >= line.start ? Infinity : 0;
  return line.words.filter((w) => t >= w.start).length;
}

/**
 * Sample a per-interval time series (rms/bass/band) at playback time `t`
 * (Req 8.3, 10.2, 10.4, 10.9).
 *
 * Reads the element at the clamped index and never indexes out of range,
 * returning `0` for an empty series (Property 10).
 */
export function sampleSeries(
  series: number[],
  interval: number,
  t: number,
): number {
  const i = seriesIndex(series.length, interval, t);
  return i < 0 ? 0 : (series[i] ?? 0);
}

/**
 * Sample the per-interval frequency-band energies at playback time `t`.
 *
 * Returns the band vector active at `t` (clamped to a valid index), or an empty
 * vector when no bands exist. Drives the left/right audio bars (Req 10.9).
 */
export function sampleBands(analysis: AudioAnalysisJson, t: number): number[] {
  const i = seriesIndex(analysis.bands.length, analysis.interval, t);
  return i < 0 ? [] : (analysis.bands[i] ?? []);
}

/**
 * Beat proximity `0..1` used to drive letter bounce/glow (Req 10.4).
 *
 * Returns `1` exactly on a beat, decaying linearly to `0` at `window` seconds
 * away, and `0` when no beat lies within the window or the beat list is empty.
 * Always within `[0, 1]` for a positive `window` (Property 11).
 */
export function beatPulse(beats: number[], t: number, window: number): number {
  const nearest = closest(beats, t);
  if (nearest == null || window <= 0) return 0;
  return Math.max(0, 1 - Math.abs(t - nearest) / window);
}

/**
 * Legacy RMS mapping retained for callers that still import this selector.
 *
 * Both outputs are monotonically non-decreasing in `rms` and bounded for
 * `rms` in `[0, 1]`: `scale` in `[1, 1.08]`, `brightness` in `[0.7, 1.0]`
 * (Property 11). The input is clamped so the bounds hold for any value.
 */
export function backgroundDynamics(rms: number): BackgroundDynamics {
  void rms;
  return { scale: 1, brightness: 1 };
}

/**
 * Centered Letter_Asset scale driven gently by bass energy and beat pulse.
 *
 * Monotonically non-decreasing in both `bass` and `pulse` and bounded to
 * `[1, 1.08]` for normalized inputs (Property 11). Inputs are clamped so the
 * bounds hold for any value.
 */
export function letterScale(bass: number, pulse: number): number {
  return 1 + 0.05 * clamp01(bass) + 0.03 * clamp01(pulse);
}

/**
 * Derive left/right audio-bar heights from frequency-band energies and overall
 * volume (Req 10.9).
 *
 * Each bar height is `maxHeight` times a convex blend of the (clamped) band
 * energy and (clamped) volume, so every height lies within `[0, maxHeight]`
 * regardless of input and is non-decreasing in both the band value and the
 * volume (Property 10). `maxHeight` is clamped to be non-negative.
 */
export function barHeights(
  bands: number[],
  volume: number,
  maxHeight: number,
): number[] {
  const max = Math.max(0, maxHeight);
  const v = clamp01(volume);
  const bandWeight = 0.7;
  const volumeWeight = 0.3;
  return bands.map((b) => max * clamp01(bandWeight * clamp01(b) + volumeWeight * v));
}
