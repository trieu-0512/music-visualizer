import { Buffer } from "node:buffer";
import {
  createReadStream as fsCreateReadStream,
  createWriteStream as fsCreateWriteStream,
} from "node:fs";
import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { isAbsolute, posix, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { workspaceRoot, type StorageConfig } from "@music-visualizer/shared/config";

/**
 * An abstract address for a stored file: a project scope plus the file's path
 * relative to that project (Req 13.2).
 *
 * @example { projectId: "0001", relativePath: "assets/letters/A.svg" }
 * @example { projectId: "0001", relativePath: "artifacts/lyrics.json" }
 */
export interface AssetRef {
  projectId: string;
  relativePath: string;
}

/**
 * A single storage interface for reading and writing project assets and
 * generated artifacts addressed by `Project_Id` and file name (Req 13.2).
 *
 * Implementations are interchangeable: the MVP {@link LocalAssetStore} persists
 * to the local file system (Req 13.1), and a future cloud backend can satisfy
 * the same interface without changes to callers (Req 13.3).
 */
export interface AssetStore {
  /** Persist `data` at `ref`, creating any missing parent directories. */
  write(ref: AssetRef, data: Buffer | NodeJS.ReadableStream): Promise<void>;
  /** Read the full contents of the file at `ref`. */
  read(ref: AssetRef): Promise<Buffer>;
  /** Open a readable stream for the file at `ref`. */
  createReadStream(ref: AssetRef): Promise<NodeJS.ReadableStream>;
  /** Report whether a file exists at `ref`. */
  exists(ref: AssetRef): Promise<boolean>;
  /** Remove the file at `ref`. A no-op when the file is absent. */
  delete(ref: AssetRef): Promise<void>;
  /** List the relative paths of all files under `projectId`, optionally filtered by `prefix`. */
  list(projectId: string, prefix?: string): Promise<string[]>;
  /**
   * Resolve `ref` to a location a consumer can read.
   *
   * The local backend resolves to an absolute file-system path; a cloud
   * backend would return a signed URL.
   */
  resolveUrl(ref: AssetRef): Promise<string>;
}

/**
 * Reject project ids that could escape the storage root or address an
 * unintended directory (path traversal, separators, drive letters).
 */
function assertSafeProjectId(projectId: string): void {
  if (
    projectId.length === 0 ||
    projectId === "." ||
    projectId === ".." ||
    projectId.includes("/") ||
    projectId.includes("\\") ||
    projectId.includes("\0")
  ) {
    throw new Error(`Invalid projectId: ${JSON.stringify(projectId)}`);
  }
}

/**
 * Validate a project-relative path and resolve it to an absolute path that is
 * guaranteed to stay inside `projectDir`.
 *
 * Guards against path traversal: absolute paths, drive-qualified paths, null
 * bytes, and any `..` segment that would escape the project scope are rejected.
 */
function resolveWithinProject(projectDir: string, relativePath: string): string {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    isAbsolute(relativePath) ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error(`Invalid relativePath: ${JSON.stringify(relativePath)}`);
  }
  const resolved = resolve(projectDir, relativePath);
  const base = projectDir.endsWith(sep) ? projectDir : projectDir + sep;
  if (resolved !== projectDir && !resolved.startsWith(base)) {
    throw new Error(`relativePath escapes project scope: ${JSON.stringify(relativePath)}`);
  }
  return resolved;
}

/**
 * Local file-system implementation of {@link AssetStore} (Req 13.1).
 *
 * Maps the abstract address `(projectId, relativePath)` to
 * `{rootDir}/projects/{projectId}/{relativePath}` on disk.
 */
export class LocalAssetStore implements AssetStore {
  private readonly rootDir: string;
  private readonly projectsDir: string;

  /**
   * @param rootDir Storage root. A relative value is resolved against the
   *   workspace root so the store behaves the same regardless of the process
   *   working directory.
   */
  constructor(rootDir: string) {
    this.rootDir = isAbsolute(rootDir) ? rootDir : resolve(workspaceRoot(), rootDir);
    this.projectsDir = resolve(this.rootDir, "projects");
  }

  private projectDir(projectId: string): string {
    assertSafeProjectId(projectId);
    return resolve(this.projectsDir, projectId);
  }

  private absolutePath(ref: AssetRef): string {
    return resolveWithinProject(this.projectDir(ref.projectId), ref.relativePath);
  }

  async write(ref: AssetRef, data: Buffer | NodeJS.ReadableStream): Promise<void> {
    const target = this.absolutePath(ref);
    await mkdir(resolve(target, ".."), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await pipeline(async function* () {
        yield data;
      }, fsCreateWriteStream(target));
      return;
    }
    await pipeline(data, fsCreateWriteStream(target));
  }

  async read(ref: AssetRef): Promise<Buffer> {
    return readFile(this.absolutePath(ref));
  }

  async createReadStream(ref: AssetRef): Promise<NodeJS.ReadableStream> {
    const target = this.absolutePath(ref);
    // Surface a clear error for a missing file rather than a deferred stream error.
    await stat(target);
    return fsCreateReadStream(target);
  }

  async exists(ref: AssetRef): Promise<boolean> {
    try {
      await stat(this.absolutePath(ref));
      return true;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw cause;
    }
  }

  async delete(ref: AssetRef): Promise<void> {
    await rm(this.absolutePath(ref), { force: true });
  }

  async list(projectId: string, prefix?: string): Promise<string[]> {
    const dir = this.projectDir(projectId);
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { recursive: true, withFileTypes: true });
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw cause;
    }
    const results: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolute = resolve(entry.parentPath, entry.name);
      const relative = absolute.slice(dir.length + 1).split(sep).join(posix.sep);
      if (prefix === undefined || relative.startsWith(prefix)) {
        results.push(relative);
      }
    }
    return results.sort();
  }

  async resolveUrl(ref: AssetRef): Promise<string> {
    return this.absolutePath(ref);
  }
}

/**
 * Select and construct the active {@link AssetStore} from configuration read at
 * startup (Req 13.4). Adding a cloud backend is a new `case` here with no
 * changes to callers (Req 13.3).
 */
export function createAssetStore(config: StorageConfig): AssetStore {
  switch (config.backend) {
    case "local":
      return new LocalAssetStore(config.rootDir);
    // case "s3": return new S3AssetStore(config.s3); // future, no caller changes
    default:
      throw new Error(`Unknown storage backend: ${(config as StorageConfig).backend}`);
  }
}
