import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import { jwtVerify } from "jose";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn().mockReturnValue("mock-jwks"),
    jwtVerify: vi.fn().mockImplementation((token: string) => {
      if (token === "valid-token") {
        return Promise.resolve({
          payload: {
            sub: "user-123",
            email: "user@acme.com",
            app_metadata: { role: "admin" },
          },
        });
      }
      if (token === "no-email-token") {
        return Promise.resolve({
          payload: {
            sub: "user-123",
            app_metadata: { role: "supplier" },
          },
        });
      }
      return Promise.reject(new Error("Invalid token"));
    }),
  };
});

type RequireAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<express.Response | void>;
let requireAuth: RequireAuth;

function makeReqRes(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
  } as unknown as express.Request & { userId?: string; userEmail?: string; userRole?: string };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as express.Response;

  const next = vi.fn();
  return { req, res, next };
}

describe("requireAuth", () => {
  beforeAll(async () => {
    process.env.SUPABASE_URL = "https://kzpviefgzrwjbpyqmqae.supabase.co";
    ({ requireAuth } = await import("./auth"));
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { req, res, next } = makeReqRes(undefined);
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with Bearer", async () => {
    const { req, res, next } = makeReqRes("Basic abc123");
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is malformed", async () => {
    const { req, res, next } = makeReqRes("Bearer badtoken");
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is signed with wrong secret", async () => {
    const { req, res, next } = makeReqRes("Bearer wrong-secret-token");
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets userId + userEmail on valid token", async () => {
    const { req, res, next } = makeReqRes("Bearer valid-token");
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("user-123");
    expect(req.userEmail).toBe("user@acme.com");
    expect(req.userRole).toBe("admin");
  });

  it("calls next without userEmail when token has no email", async () => {
    const { req, res, next } = makeReqRes("Bearer no-email-token");
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("user-123");
    expect(req.userEmail).toBeUndefined();
    expect(req.userRole).toBe("supplier");
  });

  it("returns 401 when token is expired", async () => {
    const { req, res, next } = makeReqRes("Bearer expired-token");
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
