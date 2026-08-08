import { describe, expect, it } from "vitest";
import { resolveLetter } from "./ClassicScene.js";

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
