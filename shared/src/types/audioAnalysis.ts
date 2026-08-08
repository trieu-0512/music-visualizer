/**
 * Types for the audio analysis artifact `audio-analysis.json` (Req 6, Req 15.4).
 *
 * Produced by the Audio_Analyzer and consumed by the Config_Builder and the
 * Render_Engine (to drive audio-reactive visuals). The matching JSON Schema
 * lives at `shared/src/schema/audio-analysis.schema.json`.
 */
export interface AudioAnalysisJson {
  version: 1;
  /** Audio duration in seconds (Req 6.6). */
  duration: number;
  /** Seconds between time-series samples (hop), `> 0` (Req 6.6). */
  interval: number;
  /** Sample rate of the decoded audio in Hz. */
  sampleRate: number;
  /** Normalized `0..1` RMS volume per interval (Req 6.2). */
  rms: number[];
  /** Normalized `0..1` bass energy per interval (Req 6.4). */
  bass: number[];
  /** Per interval: `bandCount` normalized `0..1` band energies (Req 6.5). */
  bands: number[][];
  /** Length of each `bands[]` entry. */
  bandCount: number;
  /** Beat_Event timestamps in seconds, ascending (Req 6.3). */
  beats: number[];
  /** Optional input lineage; production handlers populate this for new artifacts. */
  provenance?: { audioSha256: string };
}
