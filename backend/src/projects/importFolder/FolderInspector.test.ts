import { describe, expect, it } from "vitest";

import { inspectFolder, normalizeFolderPath } from "./FolderInspector.js";

describe("FolderInspector LRC support", () => {
  it("preserves an authored LRC file under authoring", () => {
    expect(normalizeFolderPath("0001/authoring/e0c06061.formatted.lrc")).toEqual({
      relativePath: "authoring/e0c06061.formatted.lrc",
      rootName: "0001",
    });
  });

  it("includes an authored LRC file in the import authoring files", () => {
    const file = {
      originalname: "e0c06061.formatted.lrc",
      buffer: Buffer.from("[00:00.00]Hello world\n"),
    } as Express.Multer.File;
    const inspected = inspectFolder(
      [file],
      ["0001/authoring/e0c06061.formatted.lrc"],
    );

    expect(inspected.authoringFiles.has("authoring/e0c06061.formatted.lrc")).toBe(true);
  });
});
