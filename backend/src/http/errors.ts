import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Uniform API error model (`backend`).
 *
 * Every failure the API surfaces is expressed as an {@link ApiError} and
 * serialized through a single error envelope so the Web_App can handle errors
 * consistently. This task introduces the model plus the `NOT_FOUND` and
 * `VALIDATION_ERROR` codes (Req 1.5); later tasks extend it with the remaining
 * documented codes (upload, precondition, missing-requirements, not-ready).
 *
 * Envelope shape (design "API Error Envelope"):
 *
 * ```json
 * { "error": { "code": "NOT_FOUND", "message": "human readable", "details": { } } }
 * ```
 */

/** Documented API error codes and the HTTP status each maps to. */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNSUPPORTED_FORMAT"
  | "TYPE_MISMATCH"
  | "PRECONDITION_FAILED"
  | "MISSING_REQUIREMENTS"
  | "ARTIFACT_NOT_READY";

/** Map each {@link ApiErrorCode} to its HTTP status (design Error Handling table). */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNSUPPORTED_FORMAT: 422,
  TYPE_MISMATCH: 422,
  PRECONDITION_FAILED: 409,
  MISSING_REQUIREMENTS: 422,
  ARTIFACT_NOT_READY: 409,
};

/** Optional structured context attached to an error (e.g. `{ missing: [...] }`). */
export type ApiErrorDetails = Record<string, unknown>;

/** The serialized error envelope returned to clients. */
export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetails;
  };
}

/**
 * A failure carrying an API error code, a human-readable message, and optional
 * structured details. Thrown or returned by services and serialized by
 * {@link errorHandler}.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }

  /** Render this error as the uniform client envelope. */
  toEnvelope(): ApiErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

/** A request for a resource that does not exist (Req 1.5). */
export function notFound(message: string, details?: ApiErrorDetails): ApiError {
  return new ApiError("NOT_FOUND", message, details);
}

/** A malformed or invalid request body/parameters. */
export function validationError(message: string, details?: ApiErrorDetails): ApiError {
  return new ApiError("VALIDATION_ERROR", message, details);
}

/**
 * Wrap an async route handler so a rejected promise is forwarded to the
 * Express error pipeline ({@link errorHandler}) rather than left unhandled.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Terminal middleware: any unmatched route resolves to a `NOT_FOUND` envelope. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(ERROR_STATUS.NOT_FOUND)
    .json(notFound(`No route for ${req.method} ${req.path}`).toEnvelope());
};

/**
 * Express error handler that serializes {@link ApiError} into the uniform
 * envelope and maps anything unexpected to a generic 500 without leaking
 * internals.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toEnvelope());
    return;
  }
  res.status(500).json({
    error: { code: "VALIDATION_ERROR", message: "Internal server error" },
  });
};
