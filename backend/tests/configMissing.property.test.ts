import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildConfig } from "../src/config/index.js";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";
import type { ProjectRecord } from "../src/projects/index.js";
import { ApiError } from "../src/http/errors.js";

/**
 * Property 8: Config generation rejects and reports every missing item
 * (Req 7.7).
 *
 * *For any* non-empty subset M of the required assets/artifacts that is absent,
 * config generation is rejected and the returned error lists exactly the items
 * in M.
 *
 * Strategy: enumerate the full set of required items — the four single-instance
 * asset roles, the 26 letters A–Z, and the two render artifacts — each paired
 * with the relative path used to seed it when present and the canonical key the
 * Config_Builder reports when it is missing (asset roles by name, letters as
 * `letter:A`..`letter:Z`, artifacts by relative path). Generate an arbitrary
 * non-empty subset to OMIT, seed every OTHER required item into a fresh
 * {@link LocalAssetStore} rooted in a temp dir, then assert `buildConfig`
 * rejects with `MISSING_REQUIREMENTS` whose `details.missing` equals EXACTLY
 * the omitted set (no present item leaks in, no missing item is dropped) and
 * that no `project-config.json` was written.
 */

/** The 26 `Letter_Asset` keys A–Z. */
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * A required item the Config_Builder checks for. `seedPath` is where a present
 * item is written; `missingKey` is how the builder names it when absent.
 */
interface RequiredItem {
  readonly missingKey: string;
  readonly seedPath: string;
}

/**
 * Every required asset and artifact, with the on-disk path used to seed it and
 * the key the Config_Builder emits when it is missing (Req 7.2, 7.6, 7.7).
 * Stored extensions are arbitrary on purpose — the builder resolves asset roles
 * by stem regardless of the uploaded extension.
 */
const REQUIRED_ITEMS: readonly RequiredItem[] = [
  { missingKey: "background", seedPath: "assets/background.jpg" },
  { missingKey: "songLogo", seedPath: "assets/song-logo.png" },
  { missingKey: "channelLogo", seedPath: "assets/channel-logo.png" },
  { missingKey: "audio", seedPath: "assets/audio.mp3" },
  ...LETTERS.map((letter) => ({
    missingKey: `letter:${letter}`,
    seedPath: `assets/letters/${letter}.svg`,
  })),
  { missingKey: "artifacts/lyrics.json", seedPath: "artifacts/lyrics.json" },
  {
    missingKey: "artifacts/audio-analysis.json",
    seedPath: "artifacts/audio-analysis.json",
  },
];

const PROJECT: ProjectRecord = {
  projectId: "p_missing",
  songName: "Twinkle Star",
  singerName: "Kids Choir",
  videoFormat: "both",
  createdAt: "2026-01-01T00:00:00Z",
};

const CONFIG_PATH = "artifacts/project-config.json";

/** Write a single required item so the Config_Builder sees it as present. */
async function seedItem(
  store: AssetStore,
  projectId: string,
  item: RequiredItem,
): Promise<void> {
  await store.write(
    { projectId, relativePath: item.seedPath },
    Buffer.from(item.missingKey),
  );
}

/**
 * Non-empty subset of required items to OMIT. `fc.subarray` preserves the
 * source order and `minLength: 1` guarantees at least one omission, satisfying
 * the "non-empty subset M" precondition of Property 8.
 */
const omittedItemsArb = fc.subarray([...REQUIRED_ITEMS], { minLength: 1 });

describe("buildConfig missing-item reporting (Property 8, Req 7.7)", () => {
  // Feature: music-visualizer, Property 8: Config generation rejects and reports every missing item
  it("rejects with MISSING_REQUIREMENTS listing exactly the omitted items, writing no config", async () => {
    await fc.assert(
      fc.asyncProperty(omittedItemsArb, async (omitted) => {
        const root = await mkdtemp(join(tmpdir(), "mv-config-missing-"));
        const store = new LocalAssetStore(root);
        try {
          const omittedKeys = new Set(omitted.map((item) => item.missingKey));

          // Seed every required item that is NOT in the omitted subset.
          for (const item of REQUIRED_ITEMS) {
            if (!omittedKeys.has(item.missingKey)) {
              await seedItem(store, PROJECT.projectId, item);
            }
          }

          const result = await buildConfig(PROJECT.projectId, store, PROJECT);

          // Generation is rejected ...
          expect(result.ok).toBe(false);
          if (result.ok) return;

          // ... with the missing-requirements error envelope (Req 7.7).
          const error = result.error;
          expect(error).toBeInstanceOf(ApiError);
          expect(error.code).toBe("MISSING_REQUIREMENTS");

          // ... whose reported missing set equals EXACTLY the omitted set:
          // every missing item is reported and no present item leaks in.
          const reported = new Set((error.details?.missing ?? []) as string[]);
          expect(reported).toEqual(omittedKeys);
          // Guard against duplicate entries inflating the report.
          expect((error.details?.missing ?? []).length).toBe(omittedKeys.size);

          // No config is written on rejection.
          expect(
            await store.exists({
              projectId: PROJECT.projectId,
              relativePath: CONFIG_PATH,
            }),
          ).toBe(false);
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
