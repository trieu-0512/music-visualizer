/**
 * Default input props for the Remotion compositions.
 *
 * Remotion requires `defaultProps` so a composition can render in the Studio
 * and so `selectComposition` / `renderMedia` have a baseline before the real
 * `project-config.json`, `lyrics.json`, and `audio-analysis.json` are supplied
 * as input props at render time. These are minimal but schema-valid artifacts;
 * the headless render (task 10.4) overrides them with the actual project data.
 */
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "@music-visualizer/shared";
import type { VideoProps } from "./Video.js";

/** Render-time frame rate for every composition and final output. */
export const FPS = 60;

/** Fallback clip duration (seconds) when analysis carries no duration. */
export const DEFAULT_DURATION_SECONDS = 10;

const LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
);

const defaultLetters: Record<string, string> = Object.fromEntries(
  LETTERS.map((l) => [l, `assets/letters/${l}.svg`]),
);

const defaultConfig: ProjectConfigJson = {
  version: 1,
  projectId: "preview",
  metadata: { songName: "Preview Song", singerName: "Preview Singer" },
  videoFormat: "both",
  assets: {
    background: "assets/background.jpg",
    songLogo: "assets/song-logo.png",
    channelLogo: "assets/channel-logo.png",
    audio: "assets/audio.mp3",
    letters: defaultLetters,
  },
  artifacts: {
    lyrics: "artifacts/lyrics.json",
    audioAnalysis: "artifacts/audio-analysis.json",
  },
  layout: {
    template: "classic-landscape",
    lyricBox: { maxLines: 2 },
    bars: { left: true, right: true },
  },
};

const defaultLyrics: LyricsJson = {
  version: 1,
  source: "original+transcriber",
  lines: [],
};

const defaultAnalysis: AudioAnalysisJson = {
  version: 1,
  duration: DEFAULT_DURATION_SECONDS,
  interval: 0.04,
  sampleRate: 44100,
  rms: [],
  bass: [],
  bands: [],
  bandCount: 0,
  beats: [],
};

/** Baseline props supplied to both compositions via `defaultProps`. */
export const defaultProps: VideoProps = {
  config: defaultConfig,
  lyrics: defaultLyrics,
  analysis: defaultAnalysis,
};

/**
 * Derive `durationInFrames` from the audio analysis duration (Req-driven by
 * input props). Always at least one frame so a composition is renderable even
 * for empty/zero-duration analysis.
 */
export function durationInFrames(props: VideoProps, fps: number): number {
  const seconds =
    props.analysis.duration > 0
      ? props.analysis.duration
      : DEFAULT_DURATION_SECONDS;
  return Math.max(1, Math.round(seconds * fps));
}
