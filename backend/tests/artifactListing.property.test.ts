import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { LocalAssetStore } from "../src/storage/index.js";
import {
  ARTIFACTS_PREFIX,
  ARTIFACT_NAMES,
  artifactRelativePath,
  listPresentArtifacts,
} from "../src/artifacts/index.js";

/**
 * Feature: music-visualizer, Property 13: Artifact listing equals the set of
 * present artifacts.
 *
 * For any subset of the seven standardized artifacts present in the Asset_Store
 * for a project, the API_Service's available-artifact listing equals exactly
 * that subset (in catalog order), with no extras and no omissions. Files under
 * `artifacts/` that are not standardized names are ignored.
 *
 * Validates: Requirements 11.1
 *
 * Strategy: generate an arbitrary subset of ARTIFACT_NAMES to write into a fresh
 * LocalAssetStore rooted in a temp dir, optionally also write some
 * NON-standardized files under `artifacts/` (which must be ignored), then call
 * `listPresentArtifacts` and assert the returned list equals EXACTLY the present
 * standardized subset in catalog order. Each run uses an isolated temp dir that
 * is removed afterwards.
 */

/**
 * An arbitrary subset of ARTIFACT_NAMES, order preserved. `fc.subarray` explores
 * the full lattice from the empty set up to all seven artifacts, so the "none
 * present" and "all present" extremes are both reachable.
 */
const presentSubsetArb = fc.subarray([...ARTIFACT_NAMES]);

const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-".split("");

/**
 * A NON-standardized file name to write under `artifacts/`. It is a lowercase
 * alphanumeric stem with an arbitrary extension, filtered so it never collides
 * with a standardized {@link ARTIFACT_NAMES} entry. These files must be ignored
 * by the listing.
 */
const nonStandardNameArb = fc
  .record({
    stem: fc
      .array(fc.constantFrom(...NAME_CHARS), { minLength: 1, maxLength: 10 })
      .map((chars) => chars.join("")),
    ext: fc.constantFrom("json", "srt", "mp4", "txt", "tmp", "bak", "log"),
  })
  .map(({ stem, ext }) => `${stem}.${ext}`)
  .filter((name) => !ARTIFACT_NAMES.includes(name as (typeof ARTIFACT_NAMES)[number]));

/** A set of distinct non-standardized file names to drop under `artifacts/`. */
const noiseArb = fc.uniqueArray(nonStandardNameArb, { minLength: 0, maxLength: 4 });

describe("Property 13: Artifact listing equals the set of present artifacts (Req 11.1)", () => {
  // Feature: music-visualizer, Property 13: Artifact listing equals the set of present artifacts
  it("lists exactly the present standardized artifacts in catalog order, ignoring non-standardized files", async () => {
    await fc.assert(
      fc.asyncProperty(presentSubsetArb, noiseArb, async (presentNames, noiseNames) => {
        const root = await mkdtemp(join(tmpdir(), "mv-artifact-listing-"));
        const store = new LocalAssetStore(root);
        const projectId = "p-artifacts";
        try {
          // Write each chosen standardized artifact at its project-relative path.
          for (const name of presentNames) {
            await store.write(
              { projectId, relativePath: artifactRelativePath(name) },
              Buffer.from(`content-for-${name}`),
            );
          }

          // Drop non-standardized files under `artifacts/`. These must be ignored
          // by the listing and never appear in the result (Req 11.1).
          for (const noise of noiseNames) {
            await store.write(
              { projectId, relativePath: `${ARTIFACTS_PREFIX}${noise}` },
              Buffer.from(`noise-${noise}`),
            );
          }

          const listed = await listPresentArtifacts(store, projectId);

          // Expected: exactly the present standardized subset, in catalog order.
          const presentSet = new Set(presentNames);
          const expected = ARTIFACT_NAMES.filter((name) => presentSet.has(name));

          // Exact equality: same members, same catalog order, no extras, no omissions.
          expect(listed).toEqual(expected);
          // Cross-checks: every listed name is standardized and present; nothing missing.
          expect(new Set(listed)).toEqual(presentSet);
          expect(listed.length).toBe(presentSet.size);
          for (const name of listed) {
            expect(ARTIFACT_NAMES).toContain(name);
          }
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
