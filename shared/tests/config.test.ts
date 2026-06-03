import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { loadConfig, parseConfig } from "../src/config/index.js";

describe("config loader", () => {
  it("loads the default config with local storage and file queue (Req 13.4)", () => {
    const config = loadConfig();
    expect(config.storage.backend).toBe("local");
    expect(config.queue.backend).toBe("file");
  });

  it("rejects an unknown storage backend", () => {
    expect(() => parseConfig({ storage: { backend: "s3", rootDir: "x" }, queue: { backend: "file", dir: "y" } }))
      .toThrow(/storage\.backend/);
  });

  it("rejects a non-object config (fast-check smoke)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.string(), fc.boolean()), (value) => {
        expect(() => parseConfig(value)).toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
