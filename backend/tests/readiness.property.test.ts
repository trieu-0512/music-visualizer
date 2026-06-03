import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { LocalAssetStore } from "../src/storage/index.js";
import {
  REQUIRED_ROLES,
  ROLE_RULES,
  baseRole,
  computeReadiness,
  storeAsset,
  type UploadedFile,
} from "../src/assets/index.js";

/**
 * Feature: music-visualizer, Property 2: Readiness reflects exactly the stored
 * required roles.
 *
 * For any subset S of the required asset roles present in the Asset_Store for a
 * project, the readiness report lists exactly S as present and exactly the
 * complement (required roles minus S) as missing.
 *
 * Validates: Requirements 2.8
 *
 * Strategy: generate an arbitrary subset S of REQUIRED_ROLES, store a valid
 * file for each chosen role into a fresh LocalAssetStore rooted in a temp dir
 * (picking a valid extension per role so the written path is one of the role's
 * candidate paths), optionally also store the OPTIONAL `originalLyrics` role to
 * confirm it never affects readiness, then assert the four readiness invariants.
 */

/** Pick a valid extension for `role` from its accepted set (design `ROLE_RULES`). */
function validExtensions(role: string): string[] {
  return ROLE_RULES[baseRole(role)].exts;
}

/** Build a plausible uploaded file for `role` carrying extension `ext`. */
function makeUpload(role: string, ext: string): UploadedFile {
  const rule = ROLE_RULES[baseRole(role)];
  return {
    originalName: `upload${ext}`,
    mimeType: rule.mimes[0],
    buffer: Buffer.from(`content-for-${role}`),
  };
}

/**
 * An arbitrary subset of REQUIRED_ROLES (order preserved). `fc.subarray`
 * explores the full lattice from the empty set up to the complete set, so the
 * "all present" (ready) and "none present" (fully missing) extremes are both
 * reachable.
 */
const subsetArb = fc.subarray(REQUIRED_ROLES);

/** A per-role seed used to vary which valid extension each stored role uses. */
const extSeedArb = fc.nat({ max: 1_000_000 });

describe("Property 2: Readiness reflects exactly the stored required roles (Req 2.8)", () => {
  // Feature: music-visualizer, Property 2: Readiness reflects exactly the stored required roles
  it("present == exactly the stored required roles; missing == the complement; they partition REQUIRED_ROLES; ready iff nothing missing", async () => {
    await fc.assert(
      fc.asyncProperty(
        subsetArb,
        extSeedArb,
        // Whether to also store the OPTIONAL originalLyrics role (not required).
        fc.boolean(),
        async (storedRoles, extSeed, storeOptionalLyrics) => {
          const root = await mkdtemp(join(tmpdir(), "mv-readiness-prop-"));
          const store = new LocalAssetStore(root);
          const projectId = "p-readiness";
          try {
            // Store a valid file for each chosen required role, varying the
            // extension among the role's accepted set for extra coverage.
            for (let i = 0; i < storedRoles.length; i++) {
              const role = storedRoles[i];
              const exts = validExtensions(role);
              const ext = exts[(extSeed + i) % exts.length];
              await storeAsset(store, projectId, role, makeUpload(role, ext));
            }

            // Optionally store the OPTIONAL originalLyrics role. It is not in
            // REQUIRED_ROLES, so it must not influence readiness either way.
            if (storeOptionalLyrics) {
              const exts = validExtensions("originalLyrics");
              const ext = exts[extSeed % exts.length];
              await storeAsset(store, projectId, "originalLyrics", makeUpload("originalLyrics", ext));
            }

            const report = await computeReadiness(store, projectId);

            const storedSet = new Set(storedRoles);
            const expectedMissing = REQUIRED_ROLES.filter((role) => !storedSet.has(role));

            // (1) present == exactly the stored required roles (S).
            expect(new Set(report.present)).toEqual(storedSet);
            // (2) missing == exactly the required roles NOT stored (complement).
            expect(new Set(report.missing)).toEqual(new Set(expectedMissing));

            // (3) present and missing partition REQUIRED_ROLES with no overlap.
            const presentSet = new Set(report.present);
            const missingSet = new Set(report.missing);
            // No overlap.
            for (const role of presentSet) {
              expect(missingSet.has(role)).toBe(false);
            }
            // Sizes sum to the whole, with no duplicates, and the union is exactly REQUIRED_ROLES.
            expect(report.present.length).toBe(presentSet.size);
            expect(report.missing.length).toBe(missingSet.size);
            expect(report.present.length + report.missing.length).toBe(REQUIRED_ROLES.length);
            expect(new Set([...presentSet, ...missingSet])).toEqual(new Set(REQUIRED_ROLES));

            // (4) ready === (missing is empty) (Req 2.8).
            expect(report.ready).toBe(report.missing.length === 0);
            // Cross-check against the model: ready iff every required role was stored.
            expect(report.ready).toBe(expectedMissing.length === 0);

            // The optional role never leaks into the readiness report.
            expect(report.present).not.toContain("originalLyrics");
            expect(report.missing).not.toContain("originalLyrics");

            expect(report.projectId).toBe(projectId);
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});
