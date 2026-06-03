import { describe, expect, it } from "vitest";
import { ApiClient, type FetchLike } from "./client.js";
import { ApiClientError } from "./ApiClientError.js";
import type { ApiErrorEnvelope, Job, ProjectRecord, ProjectView } from "./types.js";

/**
 * Unit tests for the Web_App API client (task 12.1).
 *
 * `fetch` is mocked with a recorder that captures the request shape
 * (method/url/headers/body) and returns canned `Response` objects, so the tests
 * verify request construction, uniform-envelope error parsing, and typed
 * returns without a running API_Service.
 */

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Build a mock fetch returning a fixed JSON body + status, recording the call. */
function jsonFetch(
  status: number,
  payload: unknown,
): { fetch: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (url, init = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: normalizeHeaders(init.headers),
      body: init.body,
    });
    return new Response(payload === undefined ? "" : JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch, calls };
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (headers === undefined) return {};
  return { ...(headers as Record<string, string>) };
}

const BASE = "http://api.test";

describe("ApiClient base URL", () => {
  it("trims trailing slashes from a configured base URL", async () => {
    const { fetch, calls } = jsonFetch(200, { ok: true });
    const client = new ApiClient({ baseUrl: "http://api.test/", fetch });
    await client.getReadiness("p1");
    expect(calls[0]?.url).toBe("http://api.test/projects/p1/readiness");
  });
});

describe("ApiClient.createProject", () => {
  it("POSTs JSON metadata to /projects and returns the record", async () => {
    const record: ProjectRecord = {
      projectId: "p1",
      songName: "Song",
      singerName: "Singer",
      videoFormat: "both",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const { fetch, calls } = jsonFetch(201, record);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.createProject({
      songName: "Song",
      singerName: "Singer",
      videoFormat: "both",
    });

    expect(result).toEqual(record);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${BASE}/projects`);
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      songName: "Song",
      singerName: "Singer",
      videoFormat: "both",
    });
  });
});

describe("ApiClient.importFolder", () => {
  it("POSTs files as multipart with relative paths", async () => {
    const { fetch, calls } = jsonFetch(201, {
      project: {
        projectId: "p1",
        songName: "Song",
        singerName: "Imported Folder",
        videoFormat: "both",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      readiness: { projectId: "p1", ready: true, present: [], missing: [] },
      config: null,
      artifacts: [],
    });
    const client = new ApiClient({ baseUrl: BASE, fetch });
    const file = new File(["data"], "audio.wav", { type: "audio/wav" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: "sample-song/assets/audio.wav",
      configurable: true,
    });

    const result = await client.importFolder([file], {
      songName: "Song",
      singerName: "Singer",
      videoFormat: "both",
    });

    expect(result.project.projectId).toBe("p1");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${BASE}/projects/import-folder`);
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    const form = calls[0]?.body as FormData;
    expect(form.getAll("files")).toHaveLength(1);
    expect(form.getAll("paths")).toEqual(["sample-song/assets/audio.wav"]);
    expect(form.get("metadata")).toBe(
      JSON.stringify({ songName: "Song", singerName: "Singer", videoFormat: "both" }),
    );
  });
});

describe("ApiClient.getProject", () => {
  it("GETs /projects/:id and encodes the id", async () => {
    const view: ProjectView = {
      projectId: "p 1",
      metadata: { songName: "S", singerName: "G", videoFormat: "landscape" },
      createdAt: "2024-01-01T00:00:00.000Z",
      assets: ["assets/audio.mp3"],
      artifacts: ["artifacts/lyrics.json"],
    };
    const { fetch, calls } = jsonFetch(200, view);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.getProject("p 1");

    expect(result).toEqual(view);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p%201`);
    expect(calls[0]?.body).toBeUndefined();
  });
});

describe("ApiClient.uploadAsset", () => {
  it("POSTs a multipart 'file' field to /projects/:id/assets/:role", async () => {
    const { fetch, calls } = jsonFetch(201, {
      projectId: "p1",
      role: "letter:A",
      path: "assets/letters/A.svg",
    });
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const blob = new Blob(["<svg/>"], { type: "image/svg+xml" });
    const result = await client.uploadAsset("p1", "letter:A", blob, "A.svg");

    expect(result.path).toBe("assets/letters/A.svg");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/assets/letter%3AA`);
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    // FormData carries its own multipart content type; the client must not set JSON.
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    const form = calls[0]?.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
  });
});

describe("ApiClient.getReadiness", () => {
  it("GETs the readiness report", async () => {
    const report = { projectId: "p1", ready: false, present: ["audio"], missing: ["background"] };
    const { fetch, calls } = jsonFetch(200, report);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.getReadiness("p1");

    expect(result).toEqual(report);
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/readiness`);
  });
});

describe("ApiClient.createJob", () => {
  it("POSTs the job type and params and returns the job", async () => {
    const job: Job = {
      id: "j1",
      projectId: "p1",
      type: "render",
      status: "pending",
      params: { format: "both" },
      artifacts: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    const { fetch, calls } = jsonFetch(201, job);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.createJob("p1", { type: "render", params: { format: "both" } });

    expect(result).toEqual(job);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/jobs`);
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      type: "render",
      params: { format: "both" },
    });
  });

  it("omits params when not supplied", async () => {
    const { fetch, calls } = jsonFetch(201, {
      id: "j1",
      projectId: "p1",
      type: "transcribe",
      status: "pending",
      params: {},
      artifacts: [],
      createdAt: "t",
      updatedAt: "t",
    });
    const client = new ApiClient({ baseUrl: BASE, fetch });

    await client.createJob("p1", { type: "transcribe" });

    expect(JSON.parse(calls[0]?.body as string)).toEqual({ type: "transcribe" });
  });
});

describe("ApiClient.getJob", () => {
  it("GETs /jobs/:jobId", async () => {
    const { fetch, calls } = jsonFetch(200, {
      id: "j1",
      projectId: "p1",
      type: "analyze",
      status: "completed",
      params: {},
      artifacts: ["artifacts/audio-analysis.json"],
      createdAt: "t",
      updatedAt: "t",
    });
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.getJob("j1");

    expect(result.status).toBe("completed");
    expect(calls[0]?.url).toBe(`${BASE}/jobs/j1`);
  });
});

describe("ApiClient config", () => {
  it("buildConfig POSTs /projects/:id/config", async () => {
    const config = { version: 1, projectId: "p1" };
    const { fetch, calls } = jsonFetch(200, config);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    await client.buildConfig("p1");

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/config`);
  });

  it("getConfig GETs /projects/:id/config", async () => {
    const config = { version: 1, projectId: "p1" };
    const { fetch, calls } = jsonFetch(200, config);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.getConfig("p1");

    expect((result as { projectId: string }).projectId).toBe("p1");
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/config`);
  });
});

describe("ApiClient artifacts", () => {
  it("listArtifacts GETs the artifact listing", async () => {
    const listing = { projectId: "p1", artifacts: ["lyrics.json", "lyrics.srt"] };
    const { fetch, calls } = jsonFetch(200, listing);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const result = await client.listArtifacts("p1");

    expect(result.artifacts).toEqual(["lyrics.json", "lyrics.srt"]);
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/artifacts`);
  });

  it("artifactUrl builds the absolute download URL", () => {
    const client = new ApiClient({ baseUrl: BASE, fetch: jsonFetch(200, {}).fetch });
    expect(client.artifactUrl("p1", "final-16x9-fullhd-60fps.mp4")).toBe(
      `${BASE}/projects/p1/artifacts/final-16x9-fullhd-60fps.mp4`,
    );
  });

  it("downloadArtifact returns the response bytes as a Blob", async () => {
    const calls: RecordedCall[] = [];
    const fetch: FetchLike = async (url, init = {}) => {
      calls.push({ url, method: init.method ?? "GET", headers: {}, body: init.body });
      return new Response("BINARY", { status: 200, headers: { "Content-Type": "video/mp4" } });
    };
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const blob = await client.downloadArtifact("p1", "final-16x9-fullhd-60fps.mp4");

    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe("BINARY");
    expect(calls[0]?.url).toBe(`${BASE}/projects/p1/artifacts/final-16x9-fullhd-60fps.mp4`);
  });
});

describe("ApiClient error handling", () => {
  it("parses the uniform error envelope into a typed ApiClientError", async () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: "MISSING_REQUIREMENTS",
        message: "Missing required items",
        details: { missing: ["audio", "letter:A"] },
      },
    };
    const { fetch } = jsonFetch(422, envelope);
    const client = new ApiClient({ baseUrl: BASE, fetch });

    await expect(client.buildConfig("p1")).rejects.toMatchObject({
      name: "ApiClientError",
      code: "MISSING_REQUIREMENTS",
      message: "Missing required items",
      status: 422,
      details: { missing: ["audio", "letter:A"] },
    });
  });

  it("throws ApiClientError with NOT_FOUND for an unknown project", async () => {
    const { fetch } = jsonFetch(404, {
      error: { code: "NOT_FOUND", message: "Project not found: p9" },
    });
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const error = await client.getProject("p9").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe("NOT_FOUND");
    expect((error as ApiClientError).status).toBe(404);
  });

  it("falls back to UNKNOWN when the error body is not an envelope", async () => {
    const fetch: FetchLike = async () =>
      new Response("<html>502</html>", { status: 502 });
    const client = new ApiClient({ baseUrl: BASE, fetch });

    const error = await client.getReadiness("p1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe("UNKNOWN");
    expect((error as ApiClientError).status).toBe(502);
  });
});
