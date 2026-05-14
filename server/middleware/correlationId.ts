import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incoming = req.headers["x-correlation-id"];
  const headerId = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = headerId && headerId.trim().length > 0 ? headerId : crypto.randomUUID();

  res.locals.correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}

