/**
 * Web_App API client (`frontend`).
 *
 * Public surface of the typed API_Service client consumed by the Web_App pages
 * (project create/retrieval, asset upload, readiness, jobs, config build/read,
 * artifact listing/download). Built in task 12.1; pages (12.2–12.4) import
 * `ApiClient` and the request/response types from here.
 */
export { ApiClient } from "./client.js";
export type { ApiClientOptions, CreateJobRequest, FetchLike } from "./client.js";
export { ApiClientError } from "./ApiClientError.js";
export * from "./types.js";
