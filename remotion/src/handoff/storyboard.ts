import type {
  AudioAnalysisJson,
  LyricLine,
  LyricsJson,
  ProjectConfigJson,
  VideoFormat,
  WordTiming,
} from "@music-visualizer/shared";

import type { OpenReelEffectReference } from "./effects.js";
import { OPENREEL_EFFECT_REFERENCES } from "./effects.js";

export interface HtmlVideoOutputTarget {
  id: "landscape-fullhd" | "portrait-fullhd";
  format: Exclude<VideoFormat, "both">;
  width: number;
  height: number;
  fps: number;
  fileName: string;
}

export interface HtmlVideoEffectCue {
  id: OpenReelEffectReference["id"];
  source: "openreel-reference";
  target: OpenReelEffectReference["target"];
  start: number;
  end: number;
  params: Record<string, number | string | boolean>;
}

export interface HtmlVideoScene {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  text: string;
  rows: string[];
  letter: string | null;
  letterAsset: string | null;
  words: WordTiming[];
  audio: {
    averageRms: number;
    averageBass: number;
    beatCount: number;
  };
  effects: HtmlVideoEffectCue[];
}

export interface HtmlVideoStoryboard {
  version: 1;
  renderer: "html-video";
  source: "music-visualizer";
  fps: number;
  duration: number;
  project: {
    id: string;
    songName: string;
    singerName: string;
    videoFormat: VideoFormat;
  };
  assets: ProjectConfigJson["assets"];
  outputTargets: HtmlVideoOutputTarget[];
  scenes: HtmlVideoScene[];
  effectReferences: OpenReelEffectReference[];
}

export interface StoryboardOptions {
  fps?: number;
}

const DEFAULT_FPS = 60;

export function buildHtmlVideoStoryboard(
  config: ProjectConfigJson,
  lyrics: LyricsJson,
  analysis: AudioAnalysisJson,
  options: StoryboardOptions = {},
): HtmlVideoStoryboard {
  const fps = options.fps ?? DEFAULT_FPS;
  const lyricDuration = maxLyricEnd(lyrics);
  const duration = roundSeconds(Math.max(analysis.duration, lyricDuration));

  return {
    version: 1,
    renderer: "html-video",
    source: "music-visualizer",
    fps,
    duration,
    project: {
      id: config.projectId,
      songName: config.metadata.songName,
      singerName: config.metadata.singerName,
      videoFormat: config.videoFormat,
    },
    assets: config.assets,
    outputTargets: expandStoryboardTargets(config.videoFormat, fps),
    scenes: lyrics.lines.map((line, index) =>
      buildScene(config, line, index, analysis),
    ),
    effectReferences: [...OPENREEL_EFFECT_REFERENCES],
  };
}

export function expandStoryboardTargets(
  videoFormat: VideoFormat,
  fps = DEFAULT_FPS,
): HtmlVideoOutputTarget[] {
  const targets: HtmlVideoOutputTarget[] = [];
  if (videoFormat === "landscape" || videoFormat === "both") {
    targets.push({
      id: "landscape-fullhd",
      format: "landscape",
      width: 1920,
      height: 1080,
      fps,
      fileName: "html-video-16x9-fullhd-60fps.mp4",
    });
  }
  if (videoFormat === "portrait" || videoFormat === "both") {
    targets.push({
      id: "portrait-fullhd",
      format: "portrait",
      width: 1080,
      height: 1920,
      fps,
      fileName: "html-video-9x16-fullhd-60fps.mp4",
    });
  }
  return targets;
}

function buildScene(
  config: ProjectConfigJson,
  line: LyricLine,
  index: number,
  analysis: AudioAnalysisJson,
): HtmlVideoScene {
  const letter = normalizeLetter(line.letter);
  const letterAsset = letter ? (config.assets.letters[letter] ?? null) : null;
  const start = roundSeconds(line.start);
  const end = roundSeconds(line.end);
  const averageRms = averageSeriesWindow(
    analysis.rms,
    analysis.interval,
    line.start,
    line.end,
  );
  const averageBass = averageSeriesWindow(
    analysis.bass,
    analysis.interval,
    line.start,
    line.end,
  );
  const beatCount = analysis.beats.filter(
    (beat) => beat >= line.start && beat <= line.end,
  ).length;

  return {
    id: `scene-${String(index + 1).padStart(4, "0")}-${letter ?? "gap"}`,
    index,
    start,
    end,
    duration: roundSeconds(Math.max(0, line.end - line.start)),
    text: line.text,
    rows: displayRows(line),
    letter,
    letterAsset,
    words: line.words ? [...line.words] : [],
    audio: {
      averageRms,
      averageBass,
      beatCount,
    },
    effects: buildEffectCues(line, averageRms, averageBass, beatCount),
  };
}

function buildEffectCues(
  line: LyricLine,
  averageRms: number,
  averageBass: number,
  beatCount: number,
): HtmlVideoEffectCue[] {
  const start = roundSeconds(line.start);
  const end = roundSeconds(line.end);
  const duration = roundSeconds(Math.max(0, line.end - line.start));

  return [
    {
      id: "background-audio-breathe",
      source: "openreel-reference",
      target: "background",
      start,
      end,
      params: {
        averageRms,
        maxScale: 1.08,
        minBrightness: 0.7,
      },
    },
    {
      id: "beat-letter-pop",
      source: "openreel-reference",
      target: "letter",
      start,
      end,
      params: {
        averageBass,
        beatCount,
        maxScale: 1.4,
      },
    },
    {
      id: "karaoke-word-highlight",
      source: "openreel-reference",
      target: "lyrics",
      start,
      end,
      params: {
        wordCount: line.words?.length ?? 0,
      },
    },
    {
      id: "side-audio-bars",
      source: "openreel-reference",
      target: "audio-bars",
      start,
      end,
      params: {
        averageRms,
      },
    },
    {
      id: "scene-soft-crossfade",
      source: "openreel-reference",
      target: "scene",
      start,
      end,
      params: {
        fadeSeconds: Math.min(0.25, duration / 4),
      },
    },
  ];
}

function displayRows(line: LyricLine): string[] {
  return [line.line1, line.line2].filter((row) => row.trim().length > 0);
}

function normalizeLetter(letter: string | undefined): string | null {
  if (!letter) return null;
  const normalized = letter.trim().toUpperCase();
  return /^[A-Z]$/.test(normalized) ? normalized : null;
}

function maxLyricEnd(lyrics: LyricsJson): number {
  return lyrics.lines.reduce((max, line) => Math.max(max, line.end), 0);
}

function averageSeriesWindow(
  series: number[],
  interval: number,
  start: number,
  end: number,
): number {
  if (series.length === 0 || interval <= 0 || end < start) return 0;
  const startIndex = clamp(Math.floor(start / interval), 0, series.length - 1);
  const endIndex = clamp(Math.ceil(end / interval), startIndex, series.length - 1);
  let sum = 0;
  let count = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sum += series[i] ?? 0;
    count++;
  }
  return count === 0 ? 0 : roundRatio(sum / count);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundSeconds(value: number): number {
  return Number(value.toFixed(3));
}

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}
