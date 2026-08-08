import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ROLE_RULES,
  LETTERS,
  baseRole,
  candidatePaths,
  storeAsset,
  validateUpload,
  type UploadedFile,
} from "../src/assets/index.js";
import { ApiError } from "../src/http/errors.js";
import { LocalAssetStore } from "../src/storage/index.js";

/**
 * Feature: music-visualizer, Property 1: Upload validation accepts matching
 * types, rejects mismatches, and replaces on re-upload.
 *
 * For any asset role and any uploaded file, validateUpload accepts the upload
 * exactly when the file's extension AND MIME type are both in that role's
 * allowed set (audio: MP3/WAV; original lyrics: TXT/JSON; images per role;
 * processed letters/objects and raw source images use their declared image sets) and otherwise rejects it with an error naming the expected
 * type(s) — UNSUPPORTED_FORMAT for the audio role (Req 2.4), TYPE_MISMATCH for
 * every other role (Req 2.6). And for any role and any two valid contents,
 * storing then re-uploading leaves exactly the second content stored and only
 * one file for that role (Req 2.7).
 *
 * Validates: Requirements 2.4, 2.6, 2.7
 */

/** Representative file-type roles; learningMap content/schema is covered at the route layer. */
const ROLES: string[] = [
  "audio",
  "originalLyrics",
  "background",
  "songLogo",
  "channelLogo",
  ...LETTERS.map((letter) => `letter:${letter}`),
  ...LETTERS.map((letter) => `object:${letter}`),
  ...LETTERS.map((letter) => `source:${letter}`),
];

/** Extensions drawn from every role plus foreign extensions in no role's set. */
const ALL_EXTS: string[] = [
  ".mp3",
  ".wav",
  ".txt",
  ".json",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ogg",
  ".flac",
  ".gif",
  ".bmp",
  ".pdf",
  ".mp4",
];

/** MIME types drawn from every role plus foreign MIMEs in no role's set. */
const ALL_MIMES: string[] = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "text/plain",
  "application/json",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "audio/ogg",
  "audio/flac",
  "image/gif",
  "image/bmp",
  "application/pdf",
  "video/mp4",
];

/** Pick an element from `pool`, or fall back to `fallback` when `pool` is empty. */
function fromPool(pool: string[], fallback: string[]): fc.Arbitrary<string> {
  return fc.constantFrom(...(pool.length > 0 ? pool : fallback));
}

/**
 * A validation case: a role plus an (ext, mime) pair biased to exercise all
 * four accept/reject quadrants and a fully-random pair. `upperExt` flips the
 * filename extension to upper case to exercise the case-insensitive ext match.
 */
const validationCaseArb = fc.constantFrom(...ROLES).chain((role) => {
  const rule = ROLE_RULES[baseRole(role)];
  const nonExts = ALL_EXTS.filter((ext) => !rule.exts.includes(ext));
  const nonMimes = ALL_MIMES.filter((mime) => !rule.mimes.includes(mime));

  const extInRule = fc.constantFrom(...rule.exts);
  const extNotInRule = fromPool(nonExts, ALL_EXTS);
  const mimeInRule = fc.constantFrom(...rule.mimes);
  const mimeNotInRule = fromPool(nonMimes, ALL_MIMES);

  const pair = fc.oneof(
    fc.record({ ext: extInRule, mime: mimeInRule }), // matching -> accept
    fc.record({ ext: extInRule, mime: mimeNotInRule }), // wrong mime -> reject
    fc.record({ ext: extNotInRule, mime: mimeInRule }), // wrong ext -> reject
    fc.record({ ext: extNotInRule, mime: mimeNotInRule }), // both wrong -> reject
    fc.record({ ext: fc.constantFrom(...ALL_EXTS), mime: fc.constantFrom(...ALL_MIMES) }), // random
  );

  return fc.record({ role: fc.constant(role), pair, upperExt: fc.boolean() });
});

/** A replacement case: a role and two valid (ext, mime) pairs with contents. */
const replacementCaseArb = fc.constantFrom(...ROLES).chain((role) => {
  const rule = ROLE_RULES[baseRole(role)];
  const validPair = fc.record({
    ext: fc.constantFrom(...rule.exts),
    mime: fc.constantFrom(...rule.mimes),
  });
  return fc.record({
    role: fc.constant(role),
    first: validPair,
    second: validPair,
    firstBytes: fc.uint8Array({ maxLength: 32 }),
    secondBytes: fc.uint8Array({ maxLength: 32 }),
  });
});

describe("Property 1: Upload validation accepts/rejects by type and replaces on re-upload (Req 2.4, 2.6, 2.7)", () => {
  // Feature: music-visualizer, Property 1: Upload validation accepts matching types, rejects mismatches, and replaces on re-upload
  it("accepts a file exactly when ext and MIME match the role, else rejects naming the expected type(s)", () => {
    fc.assert(
      fc.property(validationCaseArb, ({ role, pair, upperExt }) => {
        const rule = ROLE_RULES[baseRole(role)];
        const extLower = pair.ext.toLowerCase();
        const extInName = upperExt ? pair.ext.toUpperCase() : pair.ext;
        const file: UploadedFile = {
          originalName: `upload${extInName}`,
          mimeType: pair.mime,
          buffer: Buffer.from("content"),
        };

        // The upload is valid exactly when BOTH the (case-insensitive)
        // extension and the MIME type are in the role's allowed set.
        const shouldAccept = rule.exts.includes(extLower) && rule.mimes.includes(pair.mime);

        if (shouldAccept) {
          expect(() => validateUpload(role, file)).not.toThrow();
          return;
        }

        // Otherwise it must reject with the role-appropriate code and an error
        // that names the expected type(s).
        let thrown: unknown;
        try {
          validateUpload(role, file);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(ApiError);
        const apiError = thrown as ApiError;
        const expectedCode = baseRole(role) === "audio" ? "UNSUPPORTED_FORMAT" : "TYPE_MISMATCH";
        expect(apiError.code).toBe(expectedCode);
        // The error names the expected type(s): the audio message states the
        // accepted formats, and every error carries them in details.accepted.
        expect(apiError.details?.accepted).toEqual(rule.exts);
        if (baseRole(role) === "audio") {
          expect(apiError.message).toMatch(/MP3 or WAV/);
        } else {
          expect(apiError.message).toContain(rule.exts[0]);
        }
      }),
      { numRuns: 300 },
    );
  });

  // Feature: music-visualizer, Property 1: Upload validation accepts matching types, rejects mismatches, and replaces on re-upload
  it("leaves exactly the second content and only one file for the role after re-upload", async () => {
    await fc.assert(
      fc.asyncProperty(
        replacementCaseArb,
        async ({ role, first, second, firstBytes, secondBytes }) => {
          const root = await mkdtemp(join(tmpdir(), "mv-upload-replace-"));
          const store = new LocalAssetStore(root);
          const projectId = "p1";
          try {
            const file1: UploadedFile = {
              originalName: `first${first.ext}`,
              mimeType: first.mime,
              buffer: Buffer.from(firstBytes),
            };
            const file2: UploadedFile = {
              originalName: `second${second.ext}`,
              mimeType: second.mime,
              buffer: Buffer.from(secondBytes),
            };

            // Both uploads are valid for the role (precondition for storing).
            expect(() => validateUpload(role, file1)).not.toThrow();
            expect(() => validateUpload(role, file2)).not.toThrow();

            await storeAsset(store, projectId, role, file1);
            const secondPath = await storeAsset(store, projectId, role, file2);

            // Exactly one of the role's candidate paths is present, it is the
            // path of the second upload, and it holds the second content.
            const present: string[] = [];
            for (const relativePath of candidatePaths(role)) {
              if (await store.exists({ projectId, relativePath })) {
                present.push(relativePath);
              }
            }
            expect(present).toEqual([secondPath]);
            const stored = await store.read({ projectId, relativePath: secondPath });
            expect(stored).toEqual(Buffer.from(secondBytes));

            // No stray asset files accumulated for the role beyond the one file.
            const allAssetFiles = await store.list(projectId, "assets/");
            const candidateSet = new Set(candidatePaths(role));
            const remainingForRole = allAssetFiles.filter((path) => candidateSet.has(path));
            expect(remainingForRole).toEqual([secondPath]);
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});
