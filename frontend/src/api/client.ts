/**
 * Web_App API client (`frontend`).
 *
 * A typed, framework-agnostic wrapper over the API_Service REST surface used by
 * the Web_App for project management, asset upload, readiness, job
 * orchestration, config build/retrieval, and artifact listing/download
 * (Req 1.4, 2.8, 11.1, and the surrounding endpoints). It is plain TypeScript
 * (no React) so it can be unit-tested in isolation and reused by any page.
 *
 * Every non-2xx response is parsed from the uniform error envelope into a typed
 * {@link ApiClientError} and thrown, so callers branch on `error.code` rather
 * than inspecting raw responses. `fetch` is injectable for testing; the base
 * URL is configurable via the constructor or `VITE_API_BASE_URL`, defaulting to
 * the local API_Service.
 */

import { ApiClientError } from "./ApiClientError.js";
import type {
  ArtifactList,
  ArtifactName,
  AssetUploadResult,
  FolderImportResult,
  Job,
  JobType,
  ProjectConfigJson,
  ProjectJobList,
  PipelineRun,
  StartPipelineRequest,
  ProjectList,
  ProjectMetadata,
  ProjectRecord,
  ProjectView,
  ReadinessReport,
} from "./types.js";

/** The `fetch` signature the client depends on (injectable for tests). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Options for constructing an {@link ApiClient}. */
export interface ApiClientOptions {
  /** API_Service base URL; trailing slashes are trimmed. */
  baseUrl?: string;
  /** `fetch` implementation; defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** Body accepted by {@link ApiClient.createJob} (Req 3.1, 6.1, 9.1, 12.1). */
export interface CreateJobRequest {
  type: JobType;
  params?: Record<string, unknown>;
}

/** Default API_Service base URL when none is configured. */
const DEFAULT_BASE_URL = "http://localhost:3000";

/**
 * Resolve the configured base URL from Vite's environment, tolerating
 * environments where `import.meta.env` is undefined (e.g. plain unit tests).
 */
function envBaseUrl(): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_API_BASE_URL;
  } catch {
    return undefined;
  }
}

/** Typed client for the API_Service REST endpoints consumed by the Web_App. */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ApiClientOptions = {}) {
    const configured = options.baseUrl ?? envBaseUrl() ?? DEFAULT_BASE_URL;
    this.baseUrl = configured.replace(/\/+$/, "");
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("No fetch implementation available; pass one via options.fetch");
    }
    // Preserve `this` binding when using the global fetch.
    this.fetchImpl = options.fetch ?? fetchImpl.bind(globalThis);
  }

  // --- Projects (Req 1) ---------------------------------------------------

  /** Create a project and record its metadata (`POST /projects`, Req 1.1, 1.2). */
  async createProject(metadata: ProjectMetadata): Promise<ProjectRecord> {
    return this.requestJson<ProjectRecord>("POST", "/projects", { body: metadata });
  }

  /**
   * List all projects with metadata (`GET /projects`, Architecture Upgrade PR-09).
   * Sorted newest-first by the API.
   */
  async listProjects(): Promise<ProjectRecord[]> {
    const body = await this.requestJson<ProjectList>("GET", "/projects");
    return body.projects;
  }

  /**
   * Fetch a project's metadata, assets, and artifacts
   * (`GET /projects/:id`, Req 1.4). Throws `NOT_FOUND` for an unknown id.
   */
  async getProject(projectId: string): Promise<ProjectView> {
    return this.requestJson<ProjectView>("GET", `/projects/${enc(projectId)}`);
  }

  /**
   * List jobs for a project (`GET /projects/:id/jobs`, Architecture Upgrade PR-09).
   * Throws `NOT_FOUND` for an unknown project id.
   */
  async listProjectJobs(projectId: string): Promise<Job[]> {
    const body = await this.requestJson<ProjectJobList>(
      "GET",
      `/projects/${enc(projectId)}/jobs`,
    );
    return body.jobs;
  }

  /**
   * Import a complete folder in one request (`POST /projects/import-folder`).
   * Each file is sent with its `webkitRelativePath` when available so the API
   * can validate the required `assets/` and `artifacts/` layout before it
   * creates the project.
   */
  async importFolder(
    files: File[],
    metadata?: ProjectMetadata,
  ): Promise<FolderImportResult> {
    const form = new FormData();
    for (const file of files) {
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      form.append("paths", relativePath);
      form.append("files", file, relativePath);
    }
    if (metadata !== undefined) {
      form.append("metadata", JSON.stringify(metadata));
    }
    return this.requestJson<FolderImportResult>("POST", "/projects/import-folder", {
      body: form,
    });
  }

  // --- Assets (Req 2) -----------------------------------------------------

  /**
   * Upload or replace an asset for a role
   * (`POST /projects/:id/assets/:role`, Req 2.1–2.7). The file is sent as a
   * multipart field named `file`. `role` is `letter:A`..`letter:Z` for letters
   * or a plain/keyed role such as `audio`, `learningMap`, `object:A`, or
   * `source:A`.
   */
  async uploadAsset(
    projectId: string,
    role: string,
    file: Blob,
    fileName?: string,
  ): Promise<AssetUploadResult> {
    const form = new FormData();
    if (fileName !== undefined) {
      form.append("file", file, fileName);
    } else {
      form.append("file", file);
    }
    return this.requestJson<AssetUploadResult>(
      "POST",
      `/projects/${enc(projectId)}/assets/${enc(role)}`,
      { body: form },
    );
  }

  /** Report which required roles are present vs missing (`GET .../readiness`, Req 2.8). */
  async getReadiness(projectId: string): Promise<ReadinessReport> {
    return this.requestJson<ReadinessReport>("GET", `/projects/${enc(projectId)}/readiness`);
  }

  // --- Jobs (Req 3, 6, 9, 12) --------------------------------------------

  /**
   * Enqueue a `prepare-assets` / `transcribe` / `analyze` / `render` job.
   * `PRECONDITION_FAILED` is returned when the job's inputs are missing
   * (mapping for prepare-assets, audio for transcribe/analyze, config for render).
   */
  async createJob(projectId: string, request: CreateJobRequest): Promise<Job> {
    const body: CreateJobRequest =
      request.params !== undefined
        ? { type: request.type, params: request.params }
        : { type: request.type };
    return this.requestJson<Job>("POST", `/projects/${enc(projectId)}/jobs`, { body });
  }

  /** Fetch a job's current status and details (`GET /jobs/:jobId`, Req 12.2). */
  async getJob(jobId: string): Promise<Job> {
    return this.requestJson<Job>("GET", `/jobs/${enc(jobId)}`);
  }

  // --- Persistent full pipeline ------------------------------------------

  /** Start a backend-owned full pipeline that survives browser navigation/close. */
  async startPipeline(
    projectId: string,
    request: StartPipelineRequest = {},
  ): Promise<PipelineRun> {
    return this.requestJson<PipelineRun>("POST", `/projects/${enc(projectId)}/pipeline`, {
      body: request,
    });
  }

  /** Read the latest persistent pipeline run, or `null` when none has started. */
  async getPipeline(projectId: string): Promise<PipelineRun | null> {
    return this.requestJson<PipelineRun | null>("GET", `/projects/${enc(projectId)}/pipeline`);
  }

  // --- Config (Req 7, 8) --------------------------------------------------

  /**
   * Build the `project-config.json` artifact (`POST /projects/:id/config`,
   * Req 7). Returns the assembled config. Throws `MISSING_REQUIREMENTS` listing
   * each missing asset/artifact when the project is not ready.
   *
   * The build route may not be wired in every backend build; a `NOT_FOUND`
   * (no such route) surfaces as an {@link ApiClientError} the caller can handle.
   */
  async buildConfig(projectId: string): Promise<ProjectConfigJson> {
    return this.requestJson<ProjectConfigJson>("POST", `/projects/${enc(projectId)}/config`);
  }

  /**
   * Fetch the assembled `project-config.json` for preview
   * (`GET /projects/:id/config`, Req 8.1). Throws `ARTIFACT_NOT_READY` when no
   * config has been generated yet (Req 8.5).
   */
  async getConfig(projectId: string): Promise<ProjectConfigJson> {
    return this.requestJson<ProjectConfigJson>("GET", `/projects/${enc(projectId)}/config`);
  }

  // --- Artifacts (Req 11) -------------------------------------------------

  /** List the standardized artifacts currently present (`GET .../artifacts`, Req 11.1). */
  async listArtifacts(projectId: string): Promise<ArtifactList> {
    return this.requestJson<ArtifactList>("GET", `/projects/${enc(projectId)}/artifacts`);
  }

  /**
   * Build the absolute download URL for an artifact
   * (`GET /projects/:id/artifacts/:name`, Req 11.2). Useful for anchor `href`s
   * and the Remotion preview without buffering bytes through the client.
   */
  artifactUrl(projectId: string, name: ArtifactName): string {
    return `${this.baseUrl}/projects/${enc(projectId)}/artifacts/${enc(name)}`;
  }

  /**
   * Download an artifact's bytes (`GET /projects/:id/artifacts/:name`,
   * Req 11.2). Throws `ARTIFACT_NOT_READY` when the artifact has not been
   * generated yet (Req 11.4).
   */
  async downloadArtifact(projectId: string, name: ArtifactName): Promise<Blob> {
    const response = await this.fetchImpl(this.artifactUrl(projectId, name), {
      method: "GET",
    });
    if (!response.ok) {
      throw await readError(response);
    }
    return response.blob();
  }

  // --- internals ----------------------------------------------------------

  /**
   * Perform a request and decode a JSON success body, throwing a typed
   * {@link ApiClientError} on any non-2xx response. A JSON body is sent with an
   * `application/json` content type; a `FormData` body is left for the runtime
   * to set the multipart boundary.
   */
  private async requestJson<T>(
    method: string,
    path: string,
    options: { body?: unknown } = {},
  ): Promise<T> {
    const init: RequestInit = { method };
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        init.body = options.body;
      } else {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(options.body);
      }
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw await readError(response);
    }
    return (await response.json()) as T;
  }
}

/** URL-encode a path segment so ids/roles/names are transported safely. */
function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Read a non-2xx response body and convert it to a typed
 * {@link ApiClientError}, tolerating a non-JSON or empty error body.
 */
async function readError(response: Response): Promise<ApiClientError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return ApiClientError.fromResponse(response.status, body);
}
