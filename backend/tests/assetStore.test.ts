import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAssetStore,
  LocalAssetStore,
  type AssetStore,
} from "../src/storage/index.js";

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

describe("LocalAssetStore (Req 13.1, 13.2)", () => {
  let root: string;
  let store: AssetStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mv-assetstore-"));
    store = new LocalAssetStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips a buffer through write then read", async () => {
    const ref = { projectId: "0001", relativePath: "assets/audio/song.mp3" };
    const data = Buffer.from("hello world");
    await store.write(ref, data);
    expect(await store.read(ref)).toEqual(data);
  });

  it("writes from a readable stream and creates parent directories", async () => {
    const ref = { projectId: "p", relativePath: "deep/nested/dir/file.bin" };
    await store.write(ref, Readable.from([Buffer.from("ab"), Buffer.from("cd")]));
    expect(await store.read(ref)).toEqual(Buffer.from("abcd"));
  });

  it("reports existence and removes files on delete (delete is idempotent)", async () => {
    const ref = { projectId: "0001", relativePath: "artifacts/lyrics.json" };
    expect(await store.exists(ref)).toBe(false);
    await store.write(ref, Buffer.from("{}"));
    expect(await store.exists(ref)).toBe(true);
    await store.delete(ref);
    expect(await store.exists(ref)).toBe(false);
    await expect(store.delete(ref)).resolves.toBeUndefined();
  });

  it("createReadStream yields the stored contents and rejects when absent", async () => {
    const ref = { projectId: "0001", relativePath: "a/b.txt" };
    await store.write(ref, Buffer.from("streamed"));
    expect(await drain(await store.createReadStream(ref))).toEqual(Buffer.from("streamed"));
    await expect(
      store.createReadStream({ projectId: "0001", relativePath: "missing.txt" }),
    ).rejects.toThrow();
  });

  it("lists project ids under the storage root (PR-09 listProjects)", async () => {
    expect(await store.listProjects()).toEqual([]);
    await store.write({ projectId: "alpha", relativePath: "project.json" }, Buffer.from("{}"));
    await store.write({ projectId: "beta", relativePath: "assets/a.txt" }, Buffer.from("x"));
    expect(await store.listProjects()).toEqual(["alpha", "beta"]);
  });

  it("lists project-relative paths with POSIX separators and prefix filtering", async () => {
    await store.write({ projectId: "0001", relativePath: "assets/letters/A.svg" }, Buffer.from("a"));
    await store.write({ projectId: "0001", relativePath: "assets/letters/B.svg" }, Buffer.from("b"));
    await store.write({ projectId: "0001", relativePath: "artifacts/lyrics.json" }, Buffer.from("{}"));
    // Files for a different project must not leak into this listing (isolation).
    await store.write({ projectId: "0002", relativePath: "assets/letters/A.svg" }, Buffer.from("x"));

    expect(await store.list("0001")).toEqual([
      "artifacts/lyrics.json",
      "assets/letters/A.svg",
      "assets/letters/B.svg",
    ]);
    expect(await store.list("0001", "assets/letters/")).toEqual([
      "assets/letters/A.svg",
      "assets/letters/B.svg",
    ]);
    expect(await store.list("nope")).toEqual([]);
  });

  it("maps the address to {root}/projects/{projectId}/{relativePath} via resolveUrl", async () => {
    const ref = { projectId: "0001", relativePath: "assets/audio/song.mp3" };
    const url = await store.resolveUrl(ref);
    expect(isAbsolute(url)).toBe(true);
    expect(url).toBe(resolve(root, "projects", "0001", "assets", "audio", "song.mp3"));
  });

  it("rejects path traversal in relativePath and projectId", async () => {
    await expect(
      store.read({ projectId: "0001", relativePath: "../../secret" }),
    ).rejects.toThrow();
    await expect(
      store.read({ projectId: "..", relativePath: "x" }),
    ).rejects.toThrow();
    await expect(
      store.write({ projectId: "0001", relativePath: `..${sep}escape` }, Buffer.from("x")),
    ).rejects.toThrow();
  });
});

describe("createAssetStore factory (Req 13.4)", () => {
  it("constructs a LocalAssetStore for the local backend", () => {
    const store = createAssetStore({ backend: "local", rootDir: "storage" });
    expect(store).toBeInstanceOf(LocalAssetStore);
  });

  it("throws for an unknown backend", () => {
    expect(() =>
      createAssetStore({ backend: "s3" as never, rootDir: "storage" }),
    ).toThrow(/Unknown storage backend/);
  });
});
