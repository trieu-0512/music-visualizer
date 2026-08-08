import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateProjectConfig } from "@music-visualizer/shared";
import { buildConfig } from "../src/config/index.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import type { ProjectRecord } from "../src/projects/index.js";
import { ApiError } from "../src/http/errors.js";

/**
 * Minimal sanity tests for the Config_Builder (task 4.1).
 *
 * Property coverage (Properties 7 and 8) is added separately in tasks 4.2/4.3;
 * these examples confirm the happy path assembles and persists a schema-valid
 * `project-config.json`, and that a missing-item rejection lists every missing
 * required item (Req 7.1–7.7).
 */

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const LOCKED_MAPPING = {
  version: 1,
  revision: 1,
  state: "LOCKED",
  theme: {
    name: "Test Theme",
    scope: "guided",
    mappingAuthority: "project-locked",
    ageBand: "mixed-2-6",
    mode: "LETTER_NAME",
  },
  letters: Object.fromEntries(LETTERS.map((letter) => [letter, { object: `Object ${letter}` }])),
};

const PROJECT: ProjectRecord = {
  projectId: "p_0001",
  songName: "Twinkle Star",
  singerName: "Kids Choir",
  videoFormat: "both",
  createdAt: "2026-01-01T00:00:00Z",
};

/** Write the full set of required assets + artifacts so buildConfig succeeds. */
async function seedComplete(store: AssetStore, projectId: string): Promise<void> {
  await store.write({ projectId, relativePath: "assets/background.jpg" }, Buffer.from("bg"));
  await store.write({ projectId, relativePath: "assets/song-logo.png" }, Buffer.from("sl"));
  await store.write({ projectId, relativePath: "assets/channel-logo.png" }, Buffer.from("cl"));
  await store.write({ projectId, relativePath: "assets/audio.mp3" }, Buffer.from("au"));
  for (const letter of LETTERS) {
    await store.write(
      { projectId, relativePath: `assets/letters/${letter}.svg` },
      Buffer.from(`<svg>${letter}</svg>`),
    );
  }
  await store.write({ projectId, relativePath: "artifacts/lyrics.json" }, Buffer.from("{}"));
  await store.write(
    { projectId, relativePath: "artifacts/audio-analysis.json" },
    Buffer.from("{}"),
  );
}

describe("buildConfig (Req 7)", () => {
  let root: string;
  let store: AssetStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-config-"));
    store = new LocalAssetStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("assembles a schema-valid config and persists it (Req 7.1–7.6)", async () => {
    await seedComplete(store, PROJECT.projectId);

    const result = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const config = result.value;
    // Metadata and format come straight from the record (Req 7.4, 7.5).
    expect(config.metadata).toEqual({ songName: "Twinkle Star", singerName: "Kids Choir" });
    expect(config.videoFormat).toBe("both");
    // Asset paths resolve to the actually stored extensions (Req 7.2).
    expect(config.assets.background).toBe("assets/background.jpg");
    expect(config.assets.songLogo).toBe("assets/song-logo.png");
    expect(config.assets.channelLogo).toBe("assets/channel-logo.png");
    expect(config.assets.audio).toBe("assets/audio.mp3");
    expect(Object.keys(config.assets.letters)).toHaveLength(26);
    expect(config.assets.letters.A).toBe("assets/letters/A.svg");
    expect(config.assets.letters.Z).toBe("assets/letters/Z.svg");
    // Artifact paths and layout/template (Req 7.3, 7.6).
    expect(config.artifacts).toEqual({
      lyrics: "artifacts/lyrics.json",
      audioAnalysis: "artifacts/audio-analysis.json",
    });
    expect(config.layout.template).toBe("classic-landscape");

    // The assembled config validates against the shared schema.
    expect(validateProjectConfig(config).ok).toBe(true);
    expect(config.provenance?.builtAt).toBeTruthy();
    expect(config.provenance?.dependencies["assets/audio.mp3"]).toMatch(/^[a-f0-9]{64}$/);
    expect(config.provenance?.dependencies["artifacts/lyrics.json"]).toMatch(/^[a-f0-9]{64}$/);
    expect(config.provenance?.dependencies["assets/letters/A.svg"]).toMatch(/^[a-f0-9]{64}$/);

    // It was written to the standardized artifact path.
    const written = await store.read({
      projectId: PROJECT.projectId,
      relativePath: "artifacts/project-config.json",
    });
    expect(validateProjectConfig(JSON.parse(written.toString("utf-8"))).ok).toBe(true);
  });

  it("includes processed object assets when a theme-first mapping exists", async () => {
    await seedComplete(store, PROJECT.projectId);
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "authoring/mapping.json" },
      Buffer.from(JSON.stringify(LOCKED_MAPPING)),
    );
    for (const letter of LETTERS) {
      await store.write(
        { projectId: PROJECT.projectId, relativePath: `assets/objects/${letter}.png` },
        Buffer.from(`object-${letter}`),
      );
    }
    // New projects may use transparent PNG letters instead of legacy SVG.
    await store.delete({ projectId: PROJECT.projectId, relativePath: "assets/letters/A.svg" });
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/letters/A.png" },
      Buffer.from("letter-A"),
    );

    const result = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assets.letters.A).toBe("assets/letters/A.png");
    expect(Object.keys(result.value.assets.objects ?? {})).toHaveLength(26);
    expect(result.value.assets.objects?.A).toBe("assets/objects/A.png");
    expect(validateProjectConfig(result.value).ok).toBe(true);
  });

  it("requires processed object assets when a theme-first mapping exists", async () => {
    await seedComplete(store, PROJECT.projectId);
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "authoring/mapping.json" },
      Buffer.from(JSON.stringify(LOCKED_MAPPING)),
    );
    for (const letter of LETTERS.filter((value) => value !== "Q")) {
      await store.write(
        { projectId: PROJECT.projectId, relativePath: `assets/objects/${letter}.png` },
        Buffer.from(`object-${letter}`),
      );
    }
    const result = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result.error.details?.missing ?? []) as string[]).toContain("object:Q");
  });

  it("rejects structured theme-first artifacts after the audio input changes", async () => {
    await seedComplete(store, PROJECT.projectId);
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "authoring/mapping.json" },
      Buffer.from(JSON.stringify(LOCKED_MAPPING)),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "authoring/song-script.json" },
      Buffer.from(JSON.stringify({
        version: 1,
        mappingRevision: 1,
        lines: [
          {
            id: "r1-A",
            text: "A is for Object A",
            targetId: "A",
            objective: "lexical-semantic",
            objectReveal: "line-start",
          },
        ],
      })),
    );
    for (const letter of LETTERS) {
      await store.write(
        { projectId: PROJECT.projectId, relativePath: `assets/objects/${letter}.png` },
        Buffer.from(`object-${letter}`),
      );
    }
    const audioHash = createHash("sha256").update(Buffer.from("au")).digest("hex");
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "artifacts/lyrics.json" },
      Buffer.from(JSON.stringify({
        version: 1,
        source: "original+transcriber",
        lines: [
          {
            start: 0,
            end: 1,
            text: "A is for Object A",
            line1: "A is for Object A",
            line2: "",
            id: "r1-A",
            targetId: "A",
            objective: "lexical-semantic",
            letter: "A",
            object: "Object A",
            objectRevealAt: 0,
            alignmentConfidence: 1,
          },
        ],
        alignment: {
          mode: "canonical-order",
          status: "clean",
          canonicalLineCount: 1,
          segmentCount: 1,
          averageTextSimilarity: 1,
        },
        provenance: {
          audioSha256: audioHash,
          mappingRevision: 1,
          songScriptMappingRevision: 1,
        },
      })),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "artifacts/audio-analysis.json" },
      Buffer.from(JSON.stringify({
        version: 1,
        duration: 1,
        interval: 0.04,
        sampleRate: 48000,
        rms: [],
        bass: [],
        bands: [],
        bandCount: 0,
        beats: [],
        provenance: { audioSha256: audioHash },
      })),
    );

    const first = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(first.ok).toBe(true);

    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/audio.mp3" },
      Buffer.from("changed-audio"),
    );
    const stale = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.code).toBe("PRECONDITION_FAILED");
      expect(stale.error.message).toContain("stale");
    }
  });

  it("selects the portrait template for portrait projects (Req 7.3)", async () => {
    await seedComplete(store, PROJECT.projectId);
    const result = await buildConfig(PROJECT.projectId, store, {
      ...PROJECT,
      videoFormat: "portrait",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.layout.template).toBe("classic-portrait");
  });

  it("rejects with MISSING_REQUIREMENTS listing every missing item (Req 7.7)", async () => {
    // Seed everything, then remove audio and two letters to force misses.
    await seedComplete(store, PROJECT.projectId);
    await store.delete({ projectId: PROJECT.projectId, relativePath: "assets/audio.mp3" });
    await store.delete({ projectId: PROJECT.projectId, relativePath: "assets/letters/B.svg" });
    await store.delete({
      projectId: PROJECT.projectId,
      relativePath: "artifacts/audio-analysis.json",
    });

    const result = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const error = result.error;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("MISSING_REQUIREMENTS");
    expect(error.status).toBe(422);
    const missing = (error.details?.missing ?? []) as string[];
    expect(missing).toContain("audio");
    expect(missing).toContain("letter:B");
    expect(missing).toContain("artifacts/audio-analysis.json");
    // Present items are not reported.
    expect(missing).not.toContain("background");
    expect(missing).not.toContain("letter:A");

    // Nothing is written on rejection.
    expect(
      await store.exists({
        projectId: PROJECT.projectId,
        relativePath: "artifacts/project-config.json",
      }),
    ).toBe(false);
  });

  it("lists all 26 letters as missing when none are present (Req 7.7)", async () => {
    // Only top-level assets + artifacts, no letters.
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/background.jpg" },
      Buffer.from("bg"),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/song-logo.png" },
      Buffer.from("sl"),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/channel-logo.png" },
      Buffer.from("cl"),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "assets/audio.mp3" },
      Buffer.from("au"),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "artifacts/lyrics.json" },
      Buffer.from("{}"),
    );
    await store.write(
      { projectId: PROJECT.projectId, relativePath: "artifacts/audio-analysis.json" },
      Buffer.from("{}"),
    );

    const result = await buildConfig(PROJECT.projectId, store, PROJECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const missing = (result.error.details?.missing ?? []) as string[];
    for (const letter of LETTERS) {
      expect(missing).toContain(`letter:${letter}`);
    }
  });
});
