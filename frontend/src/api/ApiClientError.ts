/**
 * Typed client-side error for the Web_App API client (`frontend`).
 *
 * The API_Service serializes every failure through a uniform envelope
 * (`{ error: { code, message, details? } }`, design "API Error Envelope").
 * The client parses that envelope and throws an {@link ApiClientError} carrying
 * the documented {@link ApiErrorCode}, the human-readable message, the HTTP
 * status, and any structured `details` (e.g. `{ missing: [...] }`), so callers
 * can branch on `code` rather than re-parsing responses.
 */

import type { ApiErrorCode, ApiErrorEnvelope } from "./types.js";

export class ApiClientError extends Error {
  /** Documented API error code, or `"UNKNOWN"` when the body was not an envelope. */
  readonly code: ApiErrorCode | "UNKNOWN";
  /** HTTP status of the failed response. */
  readonly status: number;
  /** Optional structured context attached by the API (e.g. missing items). */
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode | "UNKNOWN",
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }

  /**
   * Build an {@link ApiClientError} from a non-2xx response and its already-read
   * body. A well-formed uniform envelope yields the documented code/message and
   * details; anything else falls back to `"UNKNOWN"` with a status-derived
   * message so a malformed or non-JSON error body never crashes the caller.
   */
  static fromResponse(status: number, body: unknown): ApiClientError {
    if (isErrorEnvelope(body)) {
      const { code, message, details } = body.error;
      return new ApiClientError(code, message, status, details);
    }
    return new ApiClientError("UNKNOWN", `Request failed with status ${status}`, status);
  }
}

/** Type guard for the uniform API error envelope. */
function isErrorEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (body === null || typeof body !== "object") return false;
  const error = (body as { error?: unknown }).error;
  if (error === null || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === "string" && typeof message === "string";
}
