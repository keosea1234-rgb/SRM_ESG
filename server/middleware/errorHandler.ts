// Central error handling middleware — converts AppError and unknown errors to consistent JSON responses.
import express from "express";
import { AppError } from "../shared/errors";
import logger from "../shared/logger";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string | null;
  code?: string;
}

export function sendSuccess<T>(res: express.Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data, error: null } satisfies ApiResponse<T>);
}

export function sendError(res: express.Response, status: number, message: string, code?: string): void {
  res.status(status).json({ ok: false, data: null, error: message, code } satisfies ApiResponse);
}

export function errorHandler(
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, code: err.code, message: err.message }, "App error");
    res.status(err.statusCode).json({
      ok: false,
      data: null,
      error: err.message,
      code: err.code,
    } satisfies ApiResponse);
    return;
  }
  logger.error({ errMessage: err.message, errStack: err.stack }, "Unhandled error");
  res.status(500).json({
    ok: false,
    data: null,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  } satisfies ApiResponse);
}
