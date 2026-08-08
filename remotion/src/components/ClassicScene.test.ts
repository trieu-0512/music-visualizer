import { describe, expect, it } from "vitest";
import { isObjectRevealed, resolveLetter } from "./ClassicScene.js";

describe("resolveLetter", () => {
  it("prefers an explicit validated artifact letter", () => {
    expect(resolveLetter("a", "Say it! Show it!")).toBe("A");
  });

  it("falls back only to an isolated leading learning-letter token", () => {
    expect(resolveLetter(undefined, "A is for apple")).toBe("A");
    expect(resolveLetter(undefined, "  b ... b ... book")).toBe("B");
    expect(resolveLetter(undefined, "Z! zipper")).toBe("Z");
  });

  it("does not infer letters from chorus or ordinary words", () => {
    expect(resolveLetter(undefined, "Say it! Show it! A-B-C!")).toBeUndefined();
    expect(resolveLetter(undefined, "A-B-C, sing with me")).toBeUndefined();
    expect(resolveLetter(undefined, "hello world")).toBeUndefined();
  });
});

describe("isObjectRevealed", () => {
  it("keeps legacy/teaching lines visible when no explicit reveal time exists", () => {
    expect(isObjectRevealed({}, 0)).toBe(true);
  });

  it("hides a retrieval answer until the aligned target-word onset", () => {
    const line = { objectRevealAt: 10.75 };
    expect(isObjectRevealed(line, 10.2)).toBe(false);
    expect(isObjectRevealed(line, 10.749)).toBe(false);
    expect(isObjectRevealed(line, 10.75)).toBe(true);
  });
});
