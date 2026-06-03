import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { LocalAssetStore, type AssetStore } from "../src/storage/index.js";

/**
 * Reusable storage contract suite for {@link AssetStore} implementations
 * (Property 16, Req 13.2, 13.3).
 *
 * The suite is parameterized over a `makeStore` factory that produces a fresh,
 * isolated store plus a `cleanup` callback. The MVP runs it against
 * {@link LocalAssetStore}; when an S3/R2 backend is added it can be run against
 * that backend unchanged — proving substitutability without changes to callers
 * (Req 13.3).
 */
export type StoreFactory = () => Promise<{
  store: AssetStore;
  cleanup: () => Promise<void>;
}>;

// Windows reserved device names. A path segment matching one of these (case
// insensitively, extension aside) is illegal on Windows, so generators exclude
// them to keep the property focused on storage semantics rather than OS quirks.
const RESERVED_NAMES = new Set<string>([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const SEGMENT_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

/** A single safe path segment: lowercase alphanumeric, not a reserved name. */
const segmentArb = fc
  .array(fc.constantFrom(...SEGMENT_CHARS), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(""))
  .filter((segment) => !RESERVED_NAMES.has(segment));

/** A safe `Project_Id` accepted by the store's address space (Req 13.2). */
const projectIdArb = segmentArb;

/** A project-relative path of 1–3 safe segments joined with POSIX separators. */
const relativePathArb = fc
  .array(segmentArb, { minLength: 1, maxLength: 3 })
  .map((segments) => segments.join("/"));

/** Arbitrary file contents, including the empty-buffer edge case. */
const bytesArb = fc.uint8Array({ maxLength: 48 }).map((bytes) => Buffer.from(bytes));

/** A scenario: one project plus a set of distinct (relativePath, bytes) writes. */
const scenarioArb = fc.record({
  projectId: projectIdArb,
  entries: fc.uniqueArray(fc.record({ path: relativePathArb, bytes: bytesArb }), {
    selector: (entry) => entry.path,
    minLength: 1,
    maxLength: 5,
  }),
});

/**
 * On a real file system a path cannot be both a file and a directory, so drop
 * any generated path that is a directory-prefix of another (or vice versa).
 * This keeps the generated write-set realizable on every backend.
 */
function dropPrefixConflicts<T extends { path: string }>(entries: T[]): T[] {
  const kept: T[] = [];
  for (const entry of entries) {
    const conflicts = kept.some(
      (other) =>
        other.path === entry.path ||
        entry.path.startsWith(`${other.path}/`) ||
        other.path.startsWith(`${entry.path}/`),
    );
    if (!conflicts) kept.push(entry);
  }
  return kept;
}

/**
 * Run the Property 16 contract against an arbitrary {@link AssetStore} produced
 * by `makeStore`.
 */
export function describeStorageContract(name: string, makeStore: StoreFactory): void {
  describe(`AssetStore contract: ${name} (Property 16, Req 13.2, 13.3)`, () => {
    // Feature: music-visualizer, Property 16: Storage round-trips identically across backends
    it("round-trips identically: read==write, exists only after a write, list is exactly the written paths", async () => {
      await fc.assert(
        fc.asyncProperty(scenarioArb, async ({ projectId, entries }) => {
          const { store, cleanup } = await makeStore();
          try {
            const refs = dropPrefixConflicts(entries).map((entry) => ({
              ref: { projectId, relativePath: entry.path },
              bytes: entry.bytes,
            }));

            // Before any write: `exists` is false for every path and the
            // listing is empty — `exists` reports true ONLY after a write.
            expect(await store.list(projectId)).toEqual([]);
            for (const { ref } of refs) {
              expect(await store.exists(ref)).toBe(false);
            }

            for (const { ref, bytes } of refs) {
              await store.write(ref, bytes);
            }

            // Round-trip: reading returns identical bytes and `exists` is now true.
            for (const { ref, bytes } of refs) {
              expect(await store.exists(ref)).toBe(true);
              expect(await store.read(ref)).toEqual(bytes);
            }

            // `list` includes exactly the written relative paths.
            const expectedPaths = refs.map((entry) => entry.ref.relativePath).sort();
            expect(await store.list(projectId)).toEqual(expectedPaths);

            // delete consistency: a removed path disappears from `exists` and
            // `list` while every remaining path keeps round-tripping.
            const [removed, ...remaining] = refs;
            await store.delete(removed.ref);
            expect(await store.exists(removed.ref)).toBe(false);
            expect(await store.list(projectId)).toEqual(
              remaining.map((entry) => entry.ref.relativePath).sort(),
            );
            for (const { ref, bytes } of remaining) {
              expect(await store.read(ref)).toEqual(bytes);
            }
          } finally {
            await cleanup();
          }
        }),
        { numRuns: 100 },
      );
    }, 120_000);
  });
}

/** Factory producing an isolated {@link LocalAssetStore} rooted in the OS temp dir. */
const makeLocalStore: StoreFactory = async () => {
  const root = await mkdtemp(join(tmpdir(), "mv-storage-contract-"));
  return {
    store: new LocalAssetStore(root),
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
};

// Run the reusable contract against the MVP local backend.
describeStorageContract("LocalAssetStore", makeLocalStore);
