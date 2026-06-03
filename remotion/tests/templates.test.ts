import { describe, expect, it } from "vitest";
import {
  FALLBACK_TEMPLATE_ID,
  TEMPLATES,
  resolveTemplate,
} from "../src/templates/index.js";
import { ClassicLandscape } from "../src/templates/ClassicLandscape.js";
import { ClassicPortrait } from "../src/templates/ClassicPortrait.js";

describe("TEMPLATES registry (Req 15.1, 10.10)", () => {
  it("registers the classic landscape and portrait identifiers", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([
      "classic-landscape",
      "classic-portrait",
    ]);
  });

  it("maps each identifier to its template component", () => {
    expect(TEMPLATES["classic-landscape"]).toBe(ClassicLandscape);
    expect(TEMPLATES["classic-portrait"]).toBe(ClassicPortrait);
  });

  it("resolves a known identifier to its component", () => {
    expect(resolveTemplate("classic-portrait")).toBe(ClassicPortrait);
  });

  it("falls back for an unknown identifier rather than returning undefined", () => {
    const resolved = resolveTemplate("does-not-exist");
    expect(resolved).toBe(TEMPLATES[FALLBACK_TEMPLATE_ID]);
    expect(resolved).toBeTypeOf("function");
  });
});
