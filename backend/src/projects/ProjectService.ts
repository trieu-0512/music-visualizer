import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { AssetStore, AssetRef } from "../storage/index.js";
import { notFound, validationError } from "../http/errors.js";
import type { ProjectMetadata, ProjectRecord, ProjectView } from "./ProjectRecord.js";

/** Standardized location of the internal project record within a project scope. */
const PROJECT_RECORD_PATH = "project.json";
/** Prefix under which uploaded assets live (Req 1.3, 2.x). */
const ASSETS_PREFIX = "assets/";
/** Prefix under which generated artifacts live (Req 1.3, 11.x). */
const ARTIFACTS_PREFIX = "artifacts/";

/** Accepted `Video_Format` values (Req 1.2). */
const VIDEO_FORMATS = new Set(["landscape", "portrait", "both"]);

/** Generates candidate `Project_Id` values. Injectable for deterministic tests. */
export type ProjectIdFactory = () => string;

const defaultIdFactory: ProjectIdFactory = () => `p_${randomUUID()}`;

/**
 * Owns project lifecycle and project-scoped reads (Req 1).
 *
 * Persists the internal {@link ProjectRecord} as `project.json` through the
 * {@link AssetStore} so every project's metadata and files share one
 * `Project_Id`-addressed scope (Req 1.3). All asset and artifact bytes are
 * read and written through the same store; no filesystem paths are built here.
 */
export class ProjectService {
  private readonly store: AssetStore;
  private readonly idFactory: ProjectIdFactory;

  constructor(store: AssetStore, idFactory: ProjectIdFactory = defaultIdFactory) {
    this.store = store;
    this.idFactory = idFactory;
  }

  /**
   * Create a project, assign a unique `Project_Id`, and persist the supplied
   * metadata (Req 1.1, 1.2). The id is regenerated on the rare chance a
   * candidate already addresses a stored record, guaranteeing uniqueness.
   */
  async create(metadata: ProjectMetadata): Promise<ProjectRecord> {
    const validated = validateMetadata(metadata);
    const projectId = await this.allocateId();
    const record: ProjectRecord = {
      projectId,
      songName: validated.songName,
      singerName: validated.singerName,
      videoFormat: validated.videoFormat,
      createdAt: new Date().toISOString(),
    };
    await this.store.write(this.recordRef(projectId), encodeRecord(record));
    return record;
  }

  /** Read the raw project record, or `null` when no project owns `projectId`. */
  async get(projectId: string): Promise<ProjectRecord | null> {
    if (!(await this.store.exists(this.recordRef(projectId)))) return null;
    const raw = await this.store.read(this.recordRef(projectId));
    return JSON.parse(raw.toString("utf-8")) as ProjectRecord;
  }

  /**
   * List every project with a readable `project.json`, newest first
   * (Architecture Upgrade PR-09 / `GET /projects`).
   *
   * Directories without a record are skipped so partial/corrupt folders do not
   * break the listing.
   */
  async list(): Promise<ProjectRecord[]> {
    const ids = await this.store.listProjects();
    const records: ProjectRecord[] = [];
    for (const projectId of ids) {
      try {
        const record = await this.get(projectId);
        if (record !== null) records.push(record);
      } catch {
        // Skip unreadable / malformed project.json entries.
      }
    }
    return records.sort((a, b) => {
      if (a.createdAt === b.createdAt) {
        return a.projectId < b.projectId ? 1 : a.projectId > b.projectId ? -1 : 0;
      }
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }

  /**
   * Return the project metadata, the list of stored assets, and the list of
   * generated artifacts for `projectId` (Req 1.4). Rejects an unknown id with a
   * `NOT_FOUND` error naming the missing `Project_Id` (Req 1.5).
   */
  async getView(projectId: string): Promise<ProjectView> {
    const record = await this.get(projectId);
    if (record === null) {
      throw notFound(`Project not found: ${projectId}`, { projectId });
    }
    const [assets, artifacts] = await Promise.all([
      this.store.list(projectId, ASSETS_PREFIX),
      this.store.list(projectId, ARTIFACTS_PREFIX),
    ]);
    return {
      projectId: record.projectId,
      metadata: {
        songName: record.songName,
        singerName: record.singerName,
        videoFormat: record.videoFormat,
      },
      createdAt: record.createdAt,
      assets,
      artifacts,
    };
  }

  /** Generate a `Project_Id` not already addressing a stored record. */
  private async allocateId(): Promise<string> {
    // UUID collisions are effectively impossible; the guard keeps the
    // invariant explicit and supports deterministic id factories in tests.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.idFactory();
      if (!(await this.store.exists(this.recordRef(candidate)))) {
        return candidate;
      }
    }
    throw new Error("Failed to allocate a unique Project_Id");
  }

  private recordRef(projectId: string): AssetRef {
    return { projectId, relativePath: PROJECT_RECORD_PATH };
  }
}

/** Serialize a project record to pretty-printed JSON bytes. */
function encodeRecord(record: ProjectRecord): Buffer {
  return Buffer.from(JSON.stringify(record, null, 2), "utf-8");
}

/**
 * Validate and normalize incoming `Project_Metadata`, rejecting missing or
 * mistyped fields and an unsupported `Video_Format`.
 */
function validateMetadata(metadata: ProjectMetadata): ProjectMetadata {
  if (metadata === null || typeof metadata !== "object") {
    throw validationError("Project metadata is required");
  }
  const { songName, singerName, videoFormat } = metadata;
  if (typeof songName !== "string" || songName.trim().length === 0) {
    throw validationError("songName is required");
  }
  if (typeof singerName !== "string" || singerName.trim().length === 0) {
    throw validationError("singerName is required");
  }
  if (typeof videoFormat !== "string" || !VIDEO_FORMATS.has(videoFormat)) {
    throw validationError(
      "videoFormat must be one of: landscape, portrait, both",
      { videoFormat },
    );
  }
  return { songName, singerName, videoFormat };
}
