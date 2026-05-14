import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = req.headers['x-test-user-id'] ?? 'test-user-id';
    next();
  },
}));

vi.mock('../../middleware/requireRole.js', () => ({
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.headers['x-test-role'] as string)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  },
  requireSupplierOwnership: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  writeLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/upload', () => ({
  uploadSupplierDocumentIfMultipart: (_req: any, _res: any, next: any) => next(),
  validateFileMagicBytes: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('./suppliers.service', () => ({
  getSuppliersService: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getSupplierById: vi.fn().mockResolvedValue({ ok: true, data: { id: 's-1', name: 'Acme' } }),
  createSupplier: vi.fn().mockResolvedValue({ ok: true, data: { id: 's-new' } }),
  updateSupplier: vi.fn().mockResolvedValue({ ok: true, data: { id: 's-1' } }),
  getSupplierContacts: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createSupplierContact: vi.fn().mockResolvedValue({ ok: true, data: { id: 'c-1' } }),
  getSupplierContracts: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  inviteSupplier: vi.fn().mockResolvedValue({ ok: true, data: { success: true } }),
}));

vi.mock('./approval.service', () => ({
  approveSupplier: vi.fn().mockResolvedValue({ ok: true, data: { id: 's-1' } }),
  rejectSupplier: vi.fn().mockResolvedValue({ ok: true, data: { id: 's-1' } }),
}));

vi.mock('./profile.service', () => ({
  getProfile: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  createOrUpdateProfile: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

vi.mock('./documents.service', () => ({
  listDocuments: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  uploadDocument: vi.fn().mockResolvedValue({ ok: true, data: { id: 'd-1' } }),
  approveDocument: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  rejectDocument: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  deleteDocument: vi.fn().mockResolvedValue({ ok: true, data: null }),
}));

vi.mock('../../db/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin', supplier_id: null },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('./export.controller', () => ({
  exportSuppliersCSVHandler: (_req: any, res: any) => res.status(200).send('csv'),
}));

vi.mock('./comparison.controller', () => ({
  getComparisonHandler: (_req: any, res: any) => res.status(200).json({ ok: true, data: {} }),
}));

vi.mock('./narrative.service', () => ({
  generateHealthNarrative: vi.fn().mockResolvedValue({
    supplierId: "s-1",
    generatedAt: new Date().toISOString(),
    overallSummary: "Rising risk requires attention.",
    trendDirection: "declining",
    signals: [{ type: "risk_increase", severity: "medium", message: "Risk increased." }],
  }),
}));

import suppliersRouter from './suppliers.routes';

function buildApp(role: string, userId = 'test-user-id') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.headers['x-test-role'] = role;
    req.headers['x-test-user-id'] = userId;
    next();
  });
  app.use('/api', suppliersRouter);
  return app;
}

const validContact = { name: 'Jane Doe', email: 'jane@acme.com' };

describe('suppliers routes — role enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /suppliers/:id/approve — viewer gets 403', async () => {
    const res = await request(buildApp('viewer')).post('/api/suppliers/s-1/approve');
    expect(res.status).toBe(403);
  });

  it('POST /suppliers/:id/approve — admin gets 200', async () => {
    const res = await request(buildApp('admin')).post('/api/suppliers/s-1/approve');
    expect(res.status).toBe(200);
  });

  it('POST /suppliers/:id/reject — viewer gets 403', async () => {
    const res = await request(buildApp('viewer')).post('/api/suppliers/s-1/reject');
    expect(res.status).toBe(403);
  });

  it('POST /suppliers/:id/invite — supplier role gets 403', async () => {
    const res = await request(buildApp('supplier'))
      .post('/api/suppliers/s-1/invite')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(403);
  });

  it('POST /suppliers/:id/contacts — viewer gets 403', async () => {
    const res = await request(buildApp('viewer'))
      .post('/api/suppliers/s-1/contacts')
      .send(validContact);
    expect(res.status).toBe(403);
  });

  it('POST /suppliers/:id/contacts — admin with invalid body gets 400', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/suppliers/s-1/contacts')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /suppliers/:id/contacts — admin with valid body gets 201', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/suppliers/s-1/contacts')
      .send(validContact);
    expect(res.status).toBe(201);
  });

  it('PUT /suppliers/:id/documents/:docId/approve — supplier gets 403', async () => {
    const res = await request(buildApp('supplier'))
      .put('/api/suppliers/s-1/documents/d-1/approve');
    expect(res.status).toBe(403);
  });

  it('PUT /suppliers/:id/documents/:docId/approve — admin gets 200', async () => {
    const res = await request(buildApp('admin'))
      .put('/api/suppliers/s-1/documents/d-1/approve');
    expect(res.status).toBe(200);
  });

  it('DELETE /suppliers/:id/documents/:docId — viewer gets 403', async () => {
    const res = await request(buildApp('viewer'))
      .delete('/api/suppliers/s-1/documents/d-1');
    expect(res.status).toBe(403);
  });

  it('DELETE /suppliers/:id/documents/:docId — procurement_manager gets 204', async () => {
    const res = await request(buildApp('procurement_manager'))
      .delete('/api/suppliers/s-1/documents/d-1');
    expect(res.status).toBe(204);
  });

  it('POST /suppliers/:id/reject — procurement_manager gets 200', async () => {
    const res = await request(buildApp('procurement_manager'))
      .post('/api/suppliers/s-1/reject');
    expect(res.status).toBe(200);
  });

  it("GET /suppliers/:id/health-narrative — viewer gets 200", async () => {
    const res = await request(buildApp("viewer"))
      .get("/api/suppliers/s-1/health-narrative");
    expect(res.status).toBe(200);
    expect(res.body?.data?.signals?.length).toBeGreaterThan(0);
  });
});
