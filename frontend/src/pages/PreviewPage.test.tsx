// @vitest-environment jsdom
/**
 * Component tests for the preview page (task 12.3).
 *
 * Uses a stubbed {@link ApiClient} and a mocked `@remotion/player` (the real
 * Player pulls a media stack that is heavy/unsupported under jsdom). The tests
 * assert:
 *   - the "configuration must be generated" message shows when
 *     `project-config.json` is not listed and the Player is NOT rendered (Req 8.5);
 *   - with a config + artifacts present, the Player area renders driven by the
 *     fetched config/lyrics/analysis (Req 8.1) and the landscape/portrait
 *     selector switches the composition dimensions + template (Req 8.4).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the Player so tests never instantiate the real media engine. It records
// the props it was handed so we can assert the composition is driven correctly.
const playerSpy = vi.fn();
vi.mock("@remotion/player", () => ({
  Player: (props: Record<string, unknown>) => {
    playerSpy(props);
    return (
      <div
        data-testid="mock-player"
        data-width={String(props.compositionWidth)}
        data-height={String(props.compositionHeight)}
        data-duration={String(props.durationInFrames)}
      />
    );
  },
}));

import PreviewPage from "./PreviewPage.js";
import type {
  ApiClient,
  AudioAnalysisJson,
  ArtifactName,
  LyricsJson,
  ProjectConfigJson,
  PreviewRenderJob,
} from "../api/index.js";
import type { AbcPreviewData } from "@music-visualizer/remotion/AbcPreviewVideo";
import type { PageContext } from "./types.js";

afterEach(() => {
  cleanup();
  playerSpy.mockClear();
});

const BASE_URL = "http://api.test";

function makeContext(client: Partial<ApiClient>, projectId: string | null): PageContext {
  const artifactUrl =
    client.artifactUrl ??
    ((id: string, name: string) => `${BASE_URL}/projects/${id}/artifacts/${name}`);
  return {
    client: { ...client, artifactUrl } as ApiClient,
    projectId,
    setProjectId: vi.fn(),
    navigate: vi.fn(),
  };
}

const LETTERS = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => {
    const L = String.fromCharCode(65 + i);
    return [L, `assets/letters/${L}.svg`];
  }),
);

const OBJECTS = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => {
    const L = String.fromCharCode(65 + i);
    return [L, `assets/objects/${L}.png`];
  }),
);

function sampleConfig(videoFormat: ProjectConfigJson["videoFormat"]): ProjectConfigJson {
  return {
    version: 1,
    projectId: "p1",
    metadata: { songName: "Song", singerName: "Singer" },
    videoFormat,
    assets: {
      background: "assets/background.jpg",
      songLogo: "assets/song-logo.png",
      channelLogo: "assets/channel-logo.png",
      audio: "assets/audio.mp3",
      letters: LETTERS,
      objects: OBJECTS,
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
}

const sampleLyrics: LyricsJson = {
  version: 1,
  source: "transcriber",
  lines: [
    { start: 0, end: 2, text: "Hello world", line1: "Hello world", line2: "" },
  ],
};

const sampleAnalysis: AudioAnalysisJson = {
  version: 1,
  duration: 5,
  interval: 0.04,
  sampleRate: 44100,
  rms: [0, 0.5, 1],
  bass: [0, 0.25, 0.75],
  bands: [[0.1, 0.2]],
  bandCount: 2,
  beats: [0.5, 1.5],
};

const sampleAbcPreview: AbcPreviewData = {
  metadata: { songCode: "0001", title: "Ocean Letter Splash", artist: "ABC Kids Music" },
  assets: {
    background: "assets/preview/background.png",
    songLogo: "assets/preview/song-logo.png",
    audio: "assets/preview/audio.mp3",
  },
  letters: {},
  lines: [
    {
      index: 0,
      start: 0,
      end: 5,
      text: "A for Angelfish",
      line1: "A for Angelfish",
      line2: "",
      letter: "A",
      object: "angelfish",
    },
  ],
  layout: {
    canvasWidth: 1920,
    canvasHeight: 1080,
    assetHeight: 520,
    assetY: 520,
    letterX: 560,
    objectX: 1320,
    letterScale: 1,
    objectScale: 0.92,
    objectLabelFont: 82,
    objectLabelGap: 14,
    bgBlur: 0,
    lyricBottom: 48,
    lyricWidth: 1740,
    lyricHeight: 220,
    lyricFont: 58,
    infoTop: 24,
    infoLeft: 24,
    logoTop: 22,
    logoRight: 34,
  },
};

/**
 * A blob-like value exposing `text()`. jsdom's `Blob` does not implement
 * `text()`, so the mocked client returns this shape (production browsers return
 * a real `Blob`, which does implement `text()`).
 */
function jsonBlob(body: string): Blob {
  return {
    type: "application/json",
    text: async () => body,
  } as unknown as Blob;
}

/** A client whose downloadArtifact returns the canonical artifacts as blobs. */
function readyClient(videoFormat: ProjectConfigJson["videoFormat"] = "both"): Partial<ApiClient> {
  const artifacts: ArtifactName[] = [
    "project-config.json",
    "lyrics.json",
    "audio-analysis.json",
  ];
  return {
    listArtifacts: vi.fn(async () => ({
      projectId: "p1",
      artifacts,
    })),
    getConfig: vi.fn(async () => sampleConfig(videoFormat)),
    downloadArtifact: vi.fn(async (_id: string, name: string) =>
      jsonBlob(name === "lyrics.json" ? JSON.stringify(sampleLyrics) : JSON.stringify(sampleAnalysis)),
    ) as ApiClient["downloadArtifact"],
    artifactUrl: (id: string, name: string) =>
      `${BASE_URL}/projects/${id}/artifacts/${name}`,
  };
}

describe("PreviewPage", () => {
  it("prompts to create a project when none is active", () => {
    render(<PreviewPage context={makeContext({}, null)} />);
    expect(
      screen.getByText("Load a folder first to preview its video."),
    ).toBeInTheDocument();
  });

  it("shows the 'configuration must be generated' message when config is absent", async () => {
    const listArtifacts = vi.fn(async () => ({ projectId: "p1", artifacts: [] }));
    const getConfig = vi.fn();
    render(<PreviewPage context={makeContext({ listArtifacts, getConfig }, "p1")} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Configuration must be generated before preview/i),
      ).toBeInTheDocument(),
    );
    // The Player must NOT render when there is no config (Req 8.5).
    expect(screen.queryByTestId("mock-player")).not.toBeInTheDocument();
    expect(playerSpy).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("renders the Player driven by config/lyrics/analysis once loaded", async () => {
    render(<PreviewPage context={makeContext(readyClient("both"), "p1")} />);

    const player = await screen.findByTestId("mock-player");
    expect(player).toBeInTheDocument();

    // Player was driven by the fetched artifacts (Req 8.1).
    const props = playerSpy.mock.calls.at(-1)![0];
    expect(props.inputProps.lyrics).toEqual(sampleLyrics);
    expect(props.inputProps.analysis).toEqual(sampleAnalysis);
    // Asset paths were rewritten to absolute API URLs for the in-browser Player.
    expect(props.inputProps.config.assets.background).toBe(
      `${BASE_URL}/projects/p1/assets/background.jpg`,
    );
    expect(props.inputProps.config.assets.letters.A).toBe(
      `${BASE_URL}/projects/p1/assets/letters/A.svg`,
    );
    expect(props.inputProps.config.assets.objects.A).toBe(
      `${BASE_URL}/projects/p1/assets/objects/A.png`,
    );
    // duration derived from analysis (5s * 60fps = 300 frames).
    expect(player).toHaveAttribute("data-duration", "300");
  });

  it("renders the Remotion ABC composition from preview data before render", async () => {
    const getPreviewData = vi.fn(async () => sampleAbcPreview);
    render(<PreviewPage context={makeContext({ getPreviewData }, "p1")} />);

    const player = await screen.findByTestId("mock-player");
    expect(player).toHaveAttribute("data-width", "1920");
    expect(player).toHaveAttribute("data-height", "1080");
    expect(player).toHaveAttribute("data-duration", "360");
    const previewData = playerSpy.mock.calls.at(-1)![0].inputProps.data;
    expect(previewData.metadata).toEqual(sampleAbcPreview.metadata);
    expect(previewData.assets.background).toBe(
      `${BASE_URL}/projects/p1/assets/preview/background.png`,
    );
    expect(previewData.assets.audio).toBe(
      `${BASE_URL}/projects/p1/assets/preview/audio.mp3`,
    );
    expect(screen.getByText("Remotion preview")).toBeInTheDocument();
  });

  it("resolves the completed MP4 link through the API base URL", async () => {
    const getPreviewData = vi.fn(async () => sampleAbcPreview);
    const completedJob: PreviewRenderJob = {
      id: "render-1",
      projectId: "p1",
      status: "completed",
      progress: 1,
      percent: 100,
      stage: "completed",
      renderedFrames: 480,
      encodedFrames: 480,
      totalFrames: 480,
      elapsedMs: 1_000,
      etaMs: 0,
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:01.000Z",
      outputUrl: "/projects/p1/preview-render/render-1/output",
    };
    const startPreviewRender = vi.fn(async () => completedJob);
    const previewRenderOutputUrl = vi.fn(
      (id: string, jobId: string) => `${BASE_URL}/projects/${id}/preview-render/${jobId}/output`,
    );
    render(
      <PreviewPage
        context={makeContext(
          { getPreviewData, startPreviewRender, previewRenderOutputUrl },
          "p1",
        )}
      />,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Render" }));
    const link = await screen.findByRole("link", { name: "Open MP4" });
    expect(link).toHaveAttribute(
      "href",
      `${BASE_URL}/projects/p1/preview-render/render-1/output`,
    );
  });

  it("defaults to landscape and switches dimensions + template via the selector (Req 8.4)", async () => {
    render(<PreviewPage context={makeContext(readyClient("both"), "p1")} />);

    const player = await screen.findByTestId("mock-player");
    // Default landscape dimensions + template.
    expect(player).toHaveAttribute("data-width", "1920");
    expect(player).toHaveAttribute("data-height", "1080");
    expect(playerSpy.mock.calls.at(-1)![0].inputProps.config.layout.template).toBe(
      "classic-landscape",
    );

    // Switch to portrait.
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Portrait/ }));

    await waitFor(() =>
      expect(screen.getByTestId("mock-player")).toHaveAttribute("data-width", "1080"),
    );
    const portrait = screen.getByTestId("mock-player");
    expect(portrait).toHaveAttribute("data-height", "1920");
    expect(playerSpy.mock.calls.at(-1)![0].inputProps.config.layout.template).toBe(
      "classic-portrait",
    );
  });
});
