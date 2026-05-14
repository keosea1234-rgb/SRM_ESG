import { describe, it, expect, vi } from 'vitest';
import express from 'express';

import { requireRole } from './requireRole';

function makeReqRes(userId?: string, role?: string) {
  const req = { userId, userRole: role } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as express.Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireRole', () => {
  it('returns 401 when userId is missing', async () => {
    const { req, res, next } = makeReqRes(undefined, undefined);
    await requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when profile DB query fails', async () => {
    const { req, res, next } = makeReqRes('user-1', undefined);
    await requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when profile row is missing', async () => {
    const { req, res, next } = makeReqRes('user-1', undefined);
    await requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is viewer but admin required', async () => {
    const { req, res, next } = makeReqRes('user-1', 'viewer');
    await requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is supplier but admin/procurement_manager required', async () => {
    const { req, res, next } = makeReqRes('user-1', 'supplier');
    await requireRole('admin', 'procurement_manager')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when role is admin', async () => {
    const { req, res, next } = makeReqRes('user-1', 'admin');
    await requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next when role is procurement_manager and is in allowed list', async () => {
    const { req, res, next } = makeReqRes('user-1', 'procurement_manager');
    await requireRole('admin', 'procurement_manager')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next when role is supplier and supplier is in allowed list', async () => {
    const { req, res, next } = makeReqRes('user-1', 'supplier');
    await requireRole('admin', 'procurement_manager', 'supplier')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next when one of multiple allowed roles matches', async () => {
    const { req, res, next } = makeReqRes('user-1', 'esg_analyst');
    await requireRole('admin', 'esg_analyst')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
