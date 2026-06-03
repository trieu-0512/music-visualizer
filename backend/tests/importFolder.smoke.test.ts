import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Test } from "supertest";
import { createApp } from "../src/app.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import { ProjectService } from "../src/projects/index.js";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const LYRICS = {
  version: 1,
  source: "original+transcriber",
  lines: [{ start: 0, end: 1, text: "A", line1: "A", line2: "", letter: "A" }],
};

const AUDIO_ANALYSIS = {
  version: 1,
  duration: 1,
  interval: 0.5,
  sampleRate: 44100,
  rms: [0.2, 0.3],
  bass: [0.1, 0.2],
  bands: [[0.2], [0.3]],
  bandCount: 1,
  beats: [0.5],
};

describe("folder import endpoint", () => {
  let root: string;
  let store: AssetStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-import-folder-"));
    store = new LocalAssetStore(root);
    app = createApp({
      projectService: new ProjectService(store, () => "p_imported"),
      store,
    });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a complete folder, creates a project, and builds config", async () => {
    const res = await attachCompleteFolder(
      request(app).post("/projects/import-folder"),
    );

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.project).toMatchObject({
      projectId: "p_imported",
      songName: "sample song",
      singerName: "Imported Folder",
      videoFormat: "both",
    });
    expect(res.body.readiness.ready).toBe(true);
    expect(res.body.artifacts).toEqual([
      "lyrics.json",
      "audio-analysis.json",
      "project-config.json",
    ]);
    expect(res.body.config.videoFormat).toBe("both");

    expect(
      await store.exists({
        projectId: "p_imported",
        relativePath: "assets/letters/Z.svg",
      }),
    ).toBe(true);
    expect(
      await store.exists({
        projectId: "p_imported",
        relativePath: "artifacts/project-config.json",
      }),
    ).toBe(true);
  });

  it("loads a source-only song folder without generated artifacts", async () => {
    const res = await attachCompleteFolder(
      request(app).post("/projects/import-folder"),
      {
        skip: new Set([
          "sample-song/artifacts/lyrics.json",
          "sample-song/artifacts/audio-analysis.json",
        ]),
      },
    );

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.readiness.ready).toBe(true);
    expect(res.body.config).toBeNull();
    expect(res.body.artifacts).toEqual([]);
  });

  it("loads a song folder whose required files are directly inside the folder", async () => {
    const res = await attachDirectFolder(request(app).post("/projects/import-folder"));

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.project.songName).toBe("direct song");
    expect(res.body.readiness.ready).toBe(true);
    expect(
      await store.exists({
        projectId: "p_imported",
        relativePath: "assets/background.png",
      }),
    ).toBe(true);
    expect(
      await store.exists({
        projectId: "p_imported",
        relativePath: "assets/letters/Z.svg",
      }),
    ).toBe(true);
    expect(
      await store.exists({
        projectId: "p_imported",
        relativePath: "assets/original-lyrics.md",
      }),
    ).toBe(true);
  });

  it("rejects an incomplete folder before creating a project", async () => {
    const res = await attachCompleteFolder(
      request(app).post("/projects/import-folder"),
      { skip: new Set(["sample-song/assets/background.png"]) },
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MISSING_REQUIREMENTS");
    expect(res.body.error.details.missing).toContain("background");
    expect(
      await store.exists({ projectId: "p_imported", relativePath: "project.json" }),
    ).toBe(false);
  });
});

function attachCompleteFolder(
  req: Test,
  options: { skip?: Set<string> } = {},
): Test {
  const files: { path: string; data: string; contentType: string }[] = [
    {
      path: "sample-song/assets/audio.wav",
      data: "fake wav bytes",
      contentType: "audio/wav",
    },
    {
      path: "sample-song/assets/background.png",
      data: "fake png bytes",
      contentType: "image/png",
    },
    {
      path: "sample-song/assets/song-logo.svg",
      data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      contentType: "image/svg+xml",
    },
    {
      path: "sample-song/assets/channel-logo.svg",
      data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      contentType: "image/svg+xml",
    },
    {
      path: "sample-song/artifacts/lyrics.json",
      data: JSON.stringify(LYRICS),
      contentType: "application/json",
    },
    {
      path: "sample-song/artifacts/audio-analysis.json",
      data: JSON.stringify(AUDIO_ANALYSIS),
      contentType: "application/json",
    },
    ...LETTERS.map((letter) => ({
      path: `sample-song/assets/letters/${letter}.svg`,
      data: `<svg xmlns="http://www.w3.org/2000/svg"><text>${letter}</text></svg>`,
      contentType: "image/svg+xml",
    })),
  ];

  return files.reduce((chain, file) => {
    if (options.skip?.has(file.path)) return chain;
    return chain
      .field("paths", file.path)
      .attach("files", Buffer.from(file.data), {
        filename: file.path.split("/").at(-1),
        contentType: file.contentType,
      });
  }, req);
}

function attachDirectFolder(req: Test): Test {
  const files: { path: string; data: string; contentType: string }[] = [
    { path: "direct-song/0001.mp3", data: "fake mp3 bytes", contentType: "audio/mpeg" },
    { path: "direct-song/background.png", data: "fake png bytes", contentType: "image/png" },
    {
      path: "direct-song/song-logo.svg",
      data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      contentType: "image/svg+xml",
    },
    {
      path: "direct-song/channel-logo.svg",
      data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      contentType: "image/svg+xml",
    },
    {
      path: "direct-song/0001_lyrics.md",
      data: "A is for apple",
      contentType: "text/markdown",
    },
    ...LETTERS.map((letter) => ({
      path: `direct-song/${letter}.svg`,
      data: `<svg xmlns="http://www.w3.org/2000/svg"><text>${letter}</text></svg>`,
      contentType: "image/svg+xml",
    })),
  ];

  return files.reduce(
    (chain, file) =>
      chain
        .field("paths", file.path)
        .attach("files", Buffer.from(file.data), {
          filename: file.path.split("/").at(-1),
          contentType: file.contentType,
        }),
    req,
  );
}
