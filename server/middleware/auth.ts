import express from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";

export interface AuthRequest extends express.Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error("FATAL: SUPABASE_URL is required");
}

const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

export async function requireAuth(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.userId = payload.sub;
    req.userEmail = typeof payload.email === "string" ? payload.email : undefined;
    const appMetadata =
      payload.app_metadata &&
      typeof payload.app_metadata === "object" &&
      !Array.isArray(payload.app_metadata)
        ? (payload.app_metadata as Record<string, unknown>)
        : null;
    req.userRole = (appMetadata?.role as string) ?? null;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}