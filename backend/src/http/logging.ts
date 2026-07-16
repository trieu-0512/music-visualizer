import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Structured request logging and correlation ids (Architecture Upgrade PR-13).
 *
 * - Assigns or accepts `x-request-id` and echoes it on the response.
 * - Emits a single JSON line per completed request to stdout (no extra deps).
 */

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const REQUEST_ID_HEADER = "x-request-id";

/** Attach a request id (from header or newly generated) to the request/response. */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId =
    typeof incoming === "string" && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

/** JSON access log on response finish: method, path, status, duration, requestId. */
export const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const entry = {
      level: "info",
      msg: "request",
      requestId: req.requestId ?? null,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - started,
    };
    console.log(JSON.stringify(entry));
  });
  next();
};

/** Convenience: both middlewares in order (request id first). */
export function loggingMiddleware(): RequestHandler[] {
  return [requestIdMiddleware, requestLoggingMiddleware];
}

/** Helper for structured app logs outside the HTTP path. */
export function logInfo(message: string, fields: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      level: "info",
      msg: message,
      ...fields,
    }),
  );
}

export function logError(message: string, fields: Record<string, unknown> = {}): void {
  console.error(
    JSON.stringify({
      level: "error",
      msg: message,
      ...fields,
    }),
  );
}

/** Type-only export so callers can type handlers that use `req.requestId`. */
export type RequestWithId = Request & { requestId?: string };
export type { NextFunction, Response };
