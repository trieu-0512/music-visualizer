import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildConfig } from "../src/config/index.js";
import { LocalAssetStore, type AssetRef, type AssetStore } from "../src/storage/index.js";
import type { ProjectRecord, ProjectMetadata } from "../src/projects/index.js";
import type { VideoFormat } from "@music-visualizer/shared";

/**
 * Feature: music-visualizer, Property 7: Generated config references all
 * required assets and artifacts.
 *
 * For any project whose required assets and artifacts are all present, the
 * produced `project-config.json` references the background, song logo, channel
 * logo, and audio paths, exactly 26 letter entries keyed A–Z, and the lyrics
 * and audio-analysis artifact paths.
 *
 * Validates: Requirements 7.2
 */

/** The 26 `Letter_Asset` keys A–Z that must each be referenced (Req 7.2). */
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * Valid upload extensions per required asset role (mirrors the API's
 * `ROLE_RULES`). The Config_Builder resolves each role from its stored file
 * regardless of which valid extension was uploaded, so the generator varies the
 * extension to prove the produced path tracks the actual stored file.
 */
const ASSET_EXTENSIONS = {
  background: [".png", ".jpg", ".jpeg", ".webp"],
  songLogo: [".png", ".svg"],
  channelLogo: [".png", ".svg"],
  audio: [".mp3", ".wav"],
} as const;

/** Storage file stem (under `assets/`) for each required single-instance role. */
const ASSET_FILE_STEMS = {
  background: "background",
  songLogo: "song-logo",
  channelLogo: "channel-logo",
  audio: "audio",
} as const;

const VIDEO_FORMATS: VideoFormat[] = ["landscape", "portrait", "both"];

/**
 * A complete, valid project shape: one chosen extension per required asset role
 * plus arbitrary metadata and a requested `Video_Format`. Every generated value
 * lands inside the valid input space, so `buildConfig` must always succeed.
 */
interface CompleteProject {
  projectId: string;
  backgroundExt: string;
  songLogoExt: string;
  channelLogoExt: string;
  audioExt: string;
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
}

const completeProjectArb: fc.Arbitrary<CompleteProject> = fc.record({
  projectId: fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")), {
      minLength: 1,
      maxLength: 8,
    })
    .map((chars) => `p_${chars.join("")}`),
  backgroundExt: fc.constantFrom(...ASSET_EXTENSIONS.background),
  songLogoExt: fc.constantFrom(...ASSET_EXTENSIONS.songLogo),
  channelLogoExt: fc.constantFrom(...ASSET_EXTENSIONS.channelLogo),
  audioExt: fc.constantFrom(...ASSET_EXTENSIONS.audio),
  songName: fc.string({ minLength: 1, maxLength: 40 }),
  singerName: fc.string({ minLength: 1, maxLength: 40 }),
  videoFormat: fc.constantFrom(...VIDEO_FORMATS),
});

/**
 * Seed every required asset (with the generated extensions and all 26 letters)
 * and both required artifacts into `store`, so the project is complete and
 * `buildConfig` succeeds.
 */
async function seedComplete(store: AssetStore, project: CompleteProject): Promise<void> {
  const { projectId } = project;
  const writes: Array<Promise<void>> = [
    store.write(
      { projectId, relativePath: `assets/${ASSET_FILE_STEMS.background}${project.backgroundExt}` },
      Buffer.from("bg"),
    ),
    store.write(
      { projectId, relativePath: `assets/${ASSET_FILE_STEMS.songLogo}${project.songLogoExt}` },
      Buffer.from("sl"),
    ),
    store.write(
      {
        projectId,
        relativePath: `assets/${ASSET_FILE_STEMS.channelLogo}${project.channelLogoExt}`,
      },
      Buffer.from("cl"),
    ),
    store.write(
      { projectId, relativePath: `assets/${ASSET_FILE_STEMS.audio}${project.audioExt}` },
      Buffer.from("au"),
    ),
    store.write({ projectId, relativePath: "artifacts/lyrics.json" }, Buffer.from("{}")),
    store.write({ projectId, relativePath: "artifacts/audio-analysis.json" }, Buffer.from("{}")),
  ];
  for (const letter of LETTERS) {
    writes.push(
      store.write(
        { projectId, relativePath: `assets/letters/${letter}.svg` },
        Buffer.from(`<svg>${letter}</svg>`),
      ),
    );
  }
  await Promise.all(writes);
}

function toRecord(project: CompleteProject): ProjectRecord {
  const metadata: ProjectMetadata = {
    songName: project.songName,
    singerName: project.singerName,
    videoFormat: project.videoFormat,
  };
  return {
    projectId: project.projectId,
    songName: metadata.songName,
    singerName: metadata.singerName,
    videoFormat: metadata.videoFormat,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("Property 7: Generated config references all required assets and artifacts (Req 7.2)", () => {
  it("references every required asset/artifact path and each referenced path exists in the store", async () => {
    await fc.assert(
      fc.asyncProperty(completeProjectArb, async (project) => {
        const root = await mkdtemp(join(tmpdir(), "mv-config-refs-"));
        const store = new LocalAssetStore(root);
        try {
          await seedComplete(store, project);

          const result = await buildConfig(project.projectId, store, toRecord(project));

          // A complete project always builds (the property only concerns the
          // success case — missing-item rejection is Property 8).
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          const config = result.value;

          // The single-instance asset paths track the actually stored file,
          // including the uploaded extension (Req 7.2).
          const expectedSingles: Array<[string, string]> = [
            [config.assets.background, `assets/background${project.backgroundExt}`],
            [config.assets.songLogo, `assets/song-logo${project.songLogoExt}`],
            [config.assets.channelLogo, `assets/channel-logo${project.channelLogoExt}`],
            [config.assets.audio, `assets/audio${project.audioExt}`],
          ];

          const referenced: string[] = [];
          for (const [actual, expected] of expectedSingles) {
            expect(actual).toBe(expected);
            referenced.push(actual);
          }

          // Exactly 26 letter entries keyed A–Z, each a standardized SVG path.
          expect(Object.keys(config.assets.letters).sort()).toEqual([...LETTERS].sort());
          expect(Object.keys(config.assets.letters)).toHaveLength(26);
          for (const letter of LETTERS) {
            const letterPath = config.assets.letters[letter];
            expect(letterPath).toBe(`assets/letters/${letter}.svg`);
            referenced.push(letterPath);
          }

          // The lyrics and audio-analysis artifact paths (Req 7.2 / 7.6).
          expect(config.artifacts.lyrics).toBe("artifacts/lyrics.json");
          expect(config.artifacts.audioAnalysis).toBe("artifacts/audio-analysis.json");
          referenced.push(config.artifacts.lyrics, config.artifacts.audioAnalysis);

          // Every referenced path resolves to a file that actually exists in the
          // store — the config never points at an absent file (Req 7.2).
          for (const relativePath of referenced) {
            const ref: AssetRef = { projectId: project.projectId, relativePath };
            expect(await store.exists(ref)).toBe(true);
          }
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
