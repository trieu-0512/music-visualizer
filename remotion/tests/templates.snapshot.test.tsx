// @vitest-environment jsdom
/**
 * Snapshot / visual layout tests for the Classic templates (task 10.3).
 *
 * The pixel-level layout of a template can't be property-tested, so per the
 * design ("pixel-level layout is verified with Remotion snapshot/example
 * tests") these render the landscape and portrait templates to static markup
 * at fixed playback times and assert the presence + placement of each required
 * layer:
 *
 *   - blurred Background_Asset + darkening overlay        (Req 10.1)
 *   - centered Letter_Asset for the active line           (Req 10.3)
 *   - bottom lyric box with its display rows              (Req 10.5)
 *   - top-left info box (song logo + song/singer names)   (Req 10.7)
 *   - top-right circular channel logo                     (Req 10.8)
 *
 * Frames are rendered at two fixed times — one inside an active lyric line and
 * one in the gap between lines — so the time-dependent layers (centered letter,
 * lyric box) are asserted both present and absent.
 *
 * Remotion's runtime (hooks + `<AbsoluteFill>` / `<Img>` / `<Audio>` /
 * `staticFile`) is replaced with deterministic DOM stand-ins and a controllable
 * frame so `react-dom/server` can render the real template/scene/layer
 * components in isolation, without a browser or the Remotion bundler.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  AudioAnalysisJson,
  LyricLine,
  LyricsJson,
  ProjectConfigJson,
} from "@music-visualizer/shared";

// Mutable render state shared with the `remotion` mock. Hoisted so the
// `vi.mock` factory (itself hoisted above imports) can close over it.
const remotionState = vi.hoisted(() => ({
  frame: 0,
  fps: 30,
  width: 1920,
  height: 1080,
}));

// Replace `remotion` with light DOM stand-ins. `useCurrentFrame` returns the
// controllable frame so a template can be rendered at any playback time; the
// primitives forward `data-*` attributes and styles so layout assertions work.
vi.mock("remotion", async () => {
  const { createElement } = await import("react");
  type AnyProps = Record<string, unknown> & {
    children?: unknown;
    style?: Record<string, unknown>;
  };

  const AbsoluteFill = ({ children, style, ...rest }: AnyProps) =>
    createElement(
      "div",
      {
        ...rest,
        style: { position: "absolute", inset: 0, display: "flex", ...style },
      },
      children as never,
    );

  const Img = ({ style, ...rest }: AnyProps) =>
    createElement("img", { ...rest, style });

  const Audio = ({ ...rest }: AnyProps) =>
    createElement("audio", { "data-layer": "preview-audio", ...rest });

  return {
    AbsoluteFill,
    Img,
    Audio,
    // Identity resolver so asserting on a stored asset path is straightforward.
    staticFile: (p: string) => p,
    useCurrentFrame: () => remotionState.frame,
    useVideoConfig: () => ({
      fps: remotionState.fps,
      width: remotionState.width,
      height: remotionState.height,
      durationInFrames: 300,
    }),
  };
});

// Imported after the mock is registered (vi.mock is hoisted regardless).
const { ClassicLandscape } = await import("../src/templates/ClassicLandscape.js");
const { ClassicPortrait } = await import("../src/templates/ClassicPortrait.js");

// ---------------------------------------------------------------------------
// Fixtures: a minimal but schema-shaped set of artifacts with two timed lyric
// lines (each with word timing) separated by an instrumental gap.
// ---------------------------------------------------------------------------

const LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
);

const letters: Record<string, string> = Object.fromEntries(
  LETTERS.map((l) => [l, `assets/letters/${l}.svg`]),
);

const SONG_NAME = "Twinkle Star";
const SINGER_NAME = "The Test Singers";

function makeConfig(template: string): ProjectConfigJson {
  return {
    version: 1,
    projectId: "snapshot-fixture",
    metadata: { songName: SONG_NAME, singerName: SINGER_NAME },
    videoFormat: "both",
    assets: {
      background: "assets/background.jpg",
      songLogo: "assets/song-logo.png",
      channelLogo: "assets/channel-logo.png",
      audio: "assets/audio.mp3",
      letters,
    },
    artifacts: {
      lyrics: "artifacts/lyrics.json",
      audioAnalysis: "artifacts/audio-analysis.json",
    },
    layout: {
      template,
      lyricBox: { maxLines: 2 },
      bars: { left: true, right: true },
    },
  };
}

const line1: LyricLine = {
  start: 1.0,
  end: 3.0,
  text: "H is for horse",
  line1: "H is for",
  line2: "horse",
  letter: "H",
  words: [
    { text: "H", start: 1.0, end: 1.3 },
    { text: "is", start: 1.4, end: 1.7 },
    { text: "for", start: 1.8, end: 2.2 },
    { text: "horse", start: 2.5, end: 3.0 },
  ],
};

const line2: LyricLine = {
  start: 5.0,
  end: 7.0,
  text: "Sunny day ahead",
  line1: "Sunny day",
  line2: "ahead",
  letter: "S",
  words: [
    { text: "Sunny", start: 5.0, end: 5.7 },
    { text: "day", start: 5.8, end: 6.2 },
    { text: "ahead", start: 6.3, end: 7.0 },
  ],
};

const lyrics: LyricsJson = {
  version: 1,
  source: "original+transcriber",
  lines: [line1, line2],
};

const interval = 0.5;
const sampleCount = 20; // 0..10s at 0.5s intervals
const analysis: AudioAnalysisJson = {
  version: 1,
  duration: 10,
  interval,
  sampleRate: 44100,
  rms: Array.from({ length: sampleCount }, (_, i) => (i % 5) / 4),
  bass: Array.from({ length: sampleCount }, (_, i) => (i % 4) / 3),
  bands: Array.from({ length: sampleCount }, () => [0.2, 0.5, 0.8, 0.4]),
  bandCount: 4,
  beats: [1.0, 2.0, 3.0, 5.0, 6.0, 7.0],
};

// Times: one inside line 1 (active) and one in the 3s..5s gap (no line).
const T_ACTIVE = 2.0;
const T_GAP = 4.0;

/**
 * Render a template at playback time `t` (seconds) and return a detached jsdom
 * element whose subtree is the rendered markup, ready for `querySelector`.
 */
function renderAt(
  Template: React.FC<{
    config: ProjectConfigJson;
    lyrics: LyricsJson;
    analysis: AudioAnalysisJson;
  }>,
  config: ProjectConfigJson,
  t: number,
): HTMLElement {
  remotionState.frame = Math.round(t * remotionState.fps);
  const html = renderToStaticMarkup(
    <Template config={config} lyrics={lyrics} analysis={analysis} />,
  );
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("ClassicLandscape snapshot/visual layout (Req 10.1, 10.3, 10.5, 10.7, 10.8)", () => {
  const config = makeConfig("classic-landscape");

  it("renders the blurred background plus a darkening overlay (Req 10.1)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);

    const background = root.querySelector('[data-layer="background"]');
    expect(background).not.toBeNull();

    const bgImg = background!.querySelector("img");
    expect(bgImg).not.toBeNull();
    expect(bgImg!.getAttribute("src")).toBe("assets/background.jpg");
    // The blur effect is applied via the image filter (Req 10.1).
    expect(bgImg!.getAttribute("style")).toContain("blur(");

    const overlay = root.querySelector('[data-layer="background-overlay"]');
    expect(overlay).not.toBeNull();
  });

  it("renders the active line's Letter_Asset centered in the frame (Req 10.3)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);

    const letterLayer = root.querySelector('[data-layer="center-letter"]');
    expect(letterLayer).not.toBeNull();

    // Centered both axes.
    const style = letterLayer!.getAttribute("style") ?? "";
    expect(style).toContain("justify-content:center");
    expect(style).toContain("align-items:center");

    // Shows the asset for the active line's resolved letter ("H").
    const img = letterLayer!.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("assets/letters/H.svg");

    const objectWord = letterLayer!.querySelector('[data-layer="object-word"]');
    expect(objectWord).not.toBeNull();
    expect(objectWord!.textContent).toBe("horse");
  });

  it("renders the bottom lyric box with one row per display line (Req 10.5)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);

    const lyricBox = root.querySelector('[data-layer="lyric-box"]');
    expect(lyricBox).not.toBeNull();
    // Pinned to the bottom of the frame (landscape marginBottom = 56px).
    expect(lyricBox!.getAttribute("style")).toContain("bottom:56px");

    // line1 "H is for" + line2 "horse" -> two rows, four words total.
    const rows = lyricBox!.querySelectorAll("[data-lyric-row]");
    expect(rows.length).toBe(2);
    const words = lyricBox!.querySelectorAll("[data-word]");
    expect(words.length).toBe(4);
    expect(Array.from(words).map((w) => w.textContent)).toEqual([
      "H",
      "is",
      "for",
      "horse",
    ]);
  });

  it("keeps word timing and semantic letter/object coloring (Req 10.5/10.6)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);
    const words = Array.from(
      root.querySelectorAll('[data-layer="lyric-box"] [data-word]'),
    );
    // At t=2.0 the first three words (1.0, 1.4, 1.8) are lit; "horse" (2.5) not.
    const litCount = words.filter((w) => w.getAttribute("data-lit") === "true").length;
    expect(litCount).toBe(3);
    expect(words[0].getAttribute("data-role")).toBe("letter");
    expect(words[3].getAttribute("data-role")).toBe("object");
  });

  it("renders the top-left info box with song logo and metadata (Req 10.7)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);

    const infoBox = root.querySelector('[data-layer="info-box"]');
    expect(infoBox).not.toBeNull();

    // Anchored to the top-left corner (landscape margin = 24px).
    const style = infoBox!.getAttribute("style") ?? "";
    expect(style).toContain("top:24px");
    expect(style).toContain("left:24px");

    expect(
      infoBox!.querySelector('[data-field="song-name"]')!.textContent,
    ).toBe(SONG_NAME);
    expect(
      infoBox!.querySelector('[data-field="singer-name"]')!.textContent,
    ).toBe(SINGER_NAME);

    const logo = infoBox!.querySelector("img");
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute("src")).toBe("assets/song-logo.png");
  });

  it("renders the channel logo as a circular element in the top-right (Req 10.8)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);

    const channel = root.querySelector('[data-layer="channel-logo"]');
    expect(channel).not.toBeNull();

    const style = channel!.getAttribute("style") ?? "";
    // Circular (50% radius) and pinned to the top-right (landscape margin 24px).
    expect(style).toContain("border-radius:50%");
    expect(style).toContain("top:24px");
    expect(style).toContain("right:24px");

    const img = channel!.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("assets/channel-logo.png");
  });

  it("renders left and right audio bar columns (Req 10.9)", () => {
    const root = renderAt(ClassicLandscape, config, T_ACTIVE);
    expect(root.querySelector('[data-layer="audio-bars-left"]')).not.toBeNull();
    expect(root.querySelector('[data-layer="audio-bars-right"]')).not.toBeNull();
  });

  it("hides the time-dependent layers during an instrumental gap (active vs gap)", () => {
    const active = renderAt(ClassicLandscape, config, T_ACTIVE);
    expect(active.querySelector('[data-layer="center-letter"]')).not.toBeNull();
    expect(active.querySelector('[data-layer="lyric-box"]')).not.toBeNull();

    const gap = renderAt(ClassicLandscape, config, T_GAP);
    // No active line -> no centered letter and no lyric box at t=4.0s.
    expect(gap.querySelector('[data-layer="center-letter"]')).toBeNull();
    expect(gap.querySelector('[data-layer="lyric-box"]')).toBeNull();
    // The static layers remain regardless of playback time.
    expect(gap.querySelector('[data-layer="background"]')).not.toBeNull();
    expect(gap.querySelector('[data-layer="background-overlay"]')).not.toBeNull();
    expect(gap.querySelector('[data-layer="info-box"]')).not.toBeNull();
    expect(gap.querySelector('[data-layer="channel-logo"]')).not.toBeNull();
  });

  it("shows the second line's letter once playback reaches it", () => {
    const root = renderAt(ClassicLandscape, config, 6.0); // inside line 2
    const img = root.querySelector('[data-layer="center-letter"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("assets/letters/S.svg");
  });
});

describe("ClassicPortrait snapshot/visual layout (Req 10.1, 10.3, 10.5, 10.7, 10.8)", () => {
  const config = makeConfig("classic-portrait");

  it("renders every required layer with portrait placement constants", () => {
    remotionState.width = 1080;
    remotionState.height = 1920;
    const root = renderAt(ClassicPortrait, config, T_ACTIVE);

    // All required layers present.
    expect(root.querySelector('[data-layer="background"]')).not.toBeNull();
    expect(
      root.querySelector('[data-layer="background-overlay"]'),
    ).not.toBeNull();
    expect(root.querySelector('[data-layer="center-letter"]')).not.toBeNull();
    expect(root.querySelector('[data-layer="info-box"]')).not.toBeNull();
    expect(root.querySelector('[data-layer="channel-logo"]')).not.toBeNull();

    // Portrait placement differs from landscape: lyric box sits higher
    // (marginBottom 180px) and corner margins are 26px.
    const lyricBox = root.querySelector('[data-layer="lyric-box"]');
    expect(lyricBox).not.toBeNull();
    expect(lyricBox!.getAttribute("style")).toContain("bottom:180px");

    const channel = root.querySelector('[data-layer="channel-logo"]');
    const channelStyle = channel!.getAttribute("style") ?? "";
    expect(channelStyle).toContain("border-radius:50%");
    expect(channelStyle).toContain("top:26px");
    expect(channelStyle).toContain("right:26px");

    const infoStyle =
      root.querySelector('[data-layer="info-box"]')!.getAttribute("style") ??
      "";
    expect(infoStyle).toContain("top:26px");
    expect(infoStyle).toContain("left:26px");

    // Reset shared state for any later landscape renders.
    remotionState.width = 1920;
    remotionState.height = 1080;
  });
});
