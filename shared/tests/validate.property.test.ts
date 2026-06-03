// Feature: music-visualizer, Property 17: Shared schemas accept valid artifacts
// and reject malformed ones. For any artifact produced by the shared builders
// (lyrics.json, audio-analysis.json, project-config.json), the shared validator
// accepts it; and for any malformed variant (missing required field,
// out-of-range value, wrong type, extra property), the shared validator rejects
// it with structured errors.
//
// Validates: Requirements 15.4
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  validateAudioAnalysis,
  validateLyrics,
  validateProjectConfig,
} from "../src/validate.js";
import type { ValidationError } from "../src/validate.js";
import type { Result } from "../src/result.js";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "../src/types/index.js";

// --- Shared building-block arbitraries ---------------------------------------

/** Finite number `>= 0` (matches schema `minimum: 0`). */
const nonNegativeArb = fc.double({ min: 0, max: 100_000, noNaN: true });
/** Finite number in the normalized `0..1` range (`minimum: 0, maximum: 1`). */
const unitArb = fc.double({ min: 0, max: 1, noNaN: true });
/** Non-empty string (matches schema `minLength: 1`). */
const nonEmptyStringArb = fc.string({ minLength: 1 });
/** Single uppercase A–Z key (matches `propertyNames: { pattern: "^[A-Z]$" }`). */
const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// --- Valid artifact arbitraries ----------------------------------------------

const wordTimingArb = fc.record({
  text: fc.string(),
  start: nonNegativeArb,
  end: nonNegativeArb,
});

const lyricLineArb = fc.record(
  {
    start: nonNegativeArb,
    end: nonNegativeArb,
    text: fc.string(),
    line1: fc.string(),
    line2: fc.string(),
    words: fc.array(wordTimingArb, { maxLength: 4 }),
    letter: fc.constantFrom(...LETTER_KEYS),
  },
  { requiredKeys: ["start", "end", "text", "line1", "line2"] },
);

const validLyricsArb: fc.Arbitrary<LyricsJson> = fc.record({
  version: fc.constant(1 as const),
  source: fc.constantFrom("transcriber", "original+transcriber"),
  lines: fc.array(lyricLineArb, { maxLength: 6 }),
});

const validAnalysisArb: fc.Arbitrary<AudioAnalysisJson> = fc.record({
  version: fc.constant(1 as const),
  duration: nonNegativeArb,
  interval: fc.double({ min: 0.001, max: 100, noNaN: true }),
  sampleRate: fc.integer({ min: 1, max: 192_000 }),
  rms: fc.array(unitArb, { maxLength: 8 }),
  bass: fc.array(unitArb, { maxLength: 8 }),
  bands: fc.array(fc.array(unitArb, { maxLength: 6 }), { maxLength: 6 }),
  bandCount: fc.integer({ min: 0, max: 6 }),
  beats: fc.array(nonNegativeArb, { maxLength: 8 }),
});

const lettersArb: fc.Arbitrary<Record<string, string>> = fc
  .uniqueArray(fc.constantFrom(...LETTER_KEYS), { maxLength: 26 })
  .map((keys) =>
    Object.fromEntries(keys.map((key) => [key, `assets/letters/${key}.svg`])),
  );

const validConfigArb: fc.Arbitrary<ProjectConfigJson> = fc.record({
  version: fc.constant(1 as const),
  projectId: nonEmptyStringArb,
  metadata: fc.record({ songName: fc.string(), singerName: fc.string() }),
  videoFormat: fc.constantFrom("landscape", "portrait", "both"),
  assets: fc.record({
    background: nonEmptyStringArb,
    songLogo: nonEmptyStringArb,
    channelLogo: nonEmptyStringArb,
    audio: nonEmptyStringArb,
    letters: lettersArb,
  }),
  artifacts: fc.record({
    lyrics: nonEmptyStringArb,
    audioAnalysis: nonEmptyStringArb,
  }),
  layout: fc.record({
    template: nonEmptyStringArb,
    lyricBox: fc.record({ maxLines: fc.constantFrom(1, 2) }),
    bars: fc.record({ left: fc.boolean(), right: fc.boolean() }),
  }),
});

// --- Malformed variant generators --------------------------------------------
// Each mutator takes a known-valid base and returns a variant that MUST violate
// the schema (missing required field, wrong type, out-of-range value, or an
// additional property under `additionalProperties: false`).

type Mutator<T> = (base: T) => unknown;

const lyricsMutators: Mutator<LyricsJson>[] = [
  (b) => {
    const c = { ...b } as Record<string, unknown>;
    delete c.version; // missing required field
    return c;
  },
  (b) => ({ ...b, version: 2 }), // wrong const
  (b) => ({ ...b, source: "not-a-source" }), // enum violation
  (b) => ({ ...b, lines: 5 }), // wrong type (not an array)
  (b) => ({ ...b, unexpectedExtra: true }), // additional property at root
  (b) => ({
    ...b,
    lines: [...b.lines, { start: 0, end: 1, text: "x", line1: "x" }],
  }), // line missing required `line2`
  (b) => ({
    ...b,
    lines: [...b.lines, { start: -1, end: 1, text: "x", line1: "x", line2: "" }],
  }), // negative start (below minimum)
  (b) => ({
    ...b,
    lines: [...b.lines, { start: 0, end: 1, text: 9, line1: "x", line2: "" }],
  }), // wrong type for `text`
];

const analysisMutators: Mutator<AudioAnalysisJson>[] = [
  (b) => {
    const c = { ...b } as Record<string, unknown>;
    delete c.duration; // missing required field
    return c;
  },
  (b) => ({ ...b, version: 0 }), // wrong const
  (b) => ({ ...b, interval: 0 }), // exclusiveMinimum violation
  (b) => ({ ...b, sampleRate: 0 }), // exclusiveMinimum violation
  (b) => ({ ...b, rms: [1.5] }), // above maximum (1)
  (b) => ({ ...b, bass: [-0.5] }), // below minimum (0)
  (b) => ({ ...b, bands: [[2]] }), // inner band above maximum (1)
  (b) => ({ ...b, bandCount: -1 }), // below minimum (0)
  (b) => ({ ...b, bandCount: 1.5 }), // not an integer
  (b) => ({ ...b, beats: ["x"] }), // wrong item type
  (b) => ({ ...b, surpriseField: 1 }), // additional property at root
];

const configMutators: Mutator<ProjectConfigJson>[] = [
  (b) => {
    const c = { ...b } as Record<string, unknown>;
    delete c.layout; // missing required field
    return c;
  },
  (b) => ({ ...b, version: 2 }), // wrong const
  (b) => ({ ...b, projectId: "" }), // below minLength (1)
  (b) => ({ ...b, videoFormat: "square" }), // enum violation
  (b) => ({ ...b, nope: true }), // additional property at root
  (b) => ({ ...b, metadata: { singerName: "x" } }), // missing `songName`
  (b) => ({ ...b, assets: { ...b.assets, letters: { aa: "p" } } }), // bad letter key (propertyNames)
  (b) => ({ ...b, assets: { ...b.assets, audio: "" } }), // below minLength (1)
  (b) => ({ ...b, layout: { ...b.layout, lyricBox: { maxLines: 3 } } }), // enum violation
  (b) => ({
    ...b,
    layout: { ...b.layout, bars: { left: "yes", right: false } },
  }), // wrong type for `left`
];

function malformedArb<T>(
  validArb: fc.Arbitrary<T>,
  mutators: Mutator<T>[],
): fc.Arbitrary<unknown> {
  return fc
    .tuple(validArb, fc.integer({ min: 0, max: mutators.length - 1 }))
    .map(([base, index]) => mutators[index]!(base));
}

// --- Unified artifact case arbitrary (one property, all artifacts) -----------

type ArtifactValidator = (data: unknown) => Result<unknown, ValidationError[]>;

interface ArtifactCase {
  kind: "valid" | "malformed";
  validator: ArtifactValidator;
  data: unknown;
}

function validCase(
  validator: ArtifactValidator,
  arb: fc.Arbitrary<unknown>,
): fc.Arbitrary<ArtifactCase> {
  return arb.map((data) => ({ kind: "valid", validator, data }));
}

function malformedCase(
  validator: ArtifactValidator,
  arb: fc.Arbitrary<unknown>,
): fc.Arbitrary<ArtifactCase> {
  return arb.map((data) => ({ kind: "malformed", validator, data }));
}

const artifactCaseArb: fc.Arbitrary<ArtifactCase> = fc.oneof(
  validCase(validateLyrics, validLyricsArb),
  validCase(validateAudioAnalysis, validAnalysisArb),
  validCase(validateProjectConfig, validConfigArb),
  malformedCase(validateLyrics, malformedArb(validLyricsArb, lyricsMutators)),
  malformedCase(
    validateAudioAnalysis,
    malformedArb(validAnalysisArb, analysisMutators),
  ),
  malformedCase(
    validateProjectConfig,
    malformedArb(validConfigArb, configMutators),
  ),
);

describe("Property 17: shared schemas accept valid artifacts and reject malformed ones (Req 15.4)", () => {
  it("accepts every valid artifact and rejects every malformed variant with structured errors", () => {
    fc.assert(
      fc.property(artifactCaseArb, ({ kind, validator, data }) => {
        const result = validator(data);

        if (kind === "valid") {
          // The shared validator accepts any artifact produced by the builders.
          expect(result.ok).toBe(true);
          if (result.ok) {
            // On success the typed artifact round-trips unchanged.
            expect(result.value).toEqual(data);
          }
        } else {
          // Malformed variants are rejected with at least one structured error.
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.length).toBeGreaterThan(0);
            for (const issue of result.error) {
              expect(typeof issue.path).toBe("string");
              expect(issue.path.length).toBeGreaterThan(0);
              expect(typeof issue.message).toBe("string");
              expect(issue.message.length).toBeGreaterThan(0);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
