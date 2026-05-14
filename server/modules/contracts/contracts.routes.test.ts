import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
}));

vi.mock('../../middleware/requireRole.js', () => ({
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.headers['x-test-role'] as string)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  },
}));

vi.mock('../../middleware/rateLimiter', () => ({
  writeLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('./contracts.service', () => ({
  getContractsService: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getContractByIdService: vi.fn().mockResolvedValue({ ok: true, data: { id: 'c-1', title: 'Test' } }),
  createContractService: vi.fn().mockResolvedValue({ ok: true, data: { id: 'c-new' } }),
  updateContractService: vi.fn().mockResolvedValue({ ok: true, data: { id: 'c-1' } }),
  deleteContractService: vi.fn().mockResolvedValue({ ok: true, data: null }),
}));

import contractsRouter from './contracts.routes';

function buildApp(role: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).headers['x-test-role'] = role;
    next();
  });
  app.use('/api', contractsRouter);
  return app;
}

const validContract = {
  title: 'Supply Agreement',
  expiration_date: '2027-12-31',
  status: 'active',
};

describe('contracts routes — role enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /contracts — viewer can read', async () => {
    const res = await request(buildApp('viewer')).get('/api/contracts');
    expect(res.status).toBe(200);
  });

  it('GET /contracts/:id — viewer can read single', async () => {
    const res = await request(buildApp('viewer')).get('/api/contracts/c-1');
    expect(res.status).toBe(200);
  });

  it('POST /contracts — viewer gets 403', async () => {
    const res = await request(buildApp('viewer'))
      .post('/api/contracts')
      .send(validContract);
    expect(res.status).toBe(403);
  });

  it('POST /contracts — admin with valid body gets 201', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/contracts')
      .send(validContract);
    expect(res.status).toBe(201);
  });

  it('POST /contracts — admin with invalid body gets 400', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/contracts')
      .send({ title: 'X' });
    expect(res.status).toBe(400);
  });

  it('PUT /contracts/:id — viewer gets 403', async () => {
    const res = await request(buildApp('viewer'))
      .put('/api/contracts/c-1')
      .send({ title: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('PUT /contracts/:id — procurement_manager with valid body gets 200', async () => {
    const res = await request(buildApp('procurement_manager'))
      .put('/api/contracts/c-1')
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
  });

  it('DELETE /contracts/:id — supplier gets 403', async () => {
    const res = await request(buildApp('supplier'))
      .delete('/api/contracts/c-1');
    expect(res.status).toBe(403);
  });

  it('DELETE /contracts/:id — admin gets 204', async () => {
    const res = await request(buildApp('admin'))
      .delete('/api/contracts/c-1');
    expect(res.status).toBe(204);
  });

  it('POST /contracts — procurement_manager can create', async () => {
    const res = await request(buildApp('procurement_manager'))
      .post('/api/contracts')
      .send(validContract);
    expect(res.status).toBe(201);
  });
});
