import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate';

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const testSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
});

describe('validate middleware', () => {
  it('calls next() when body is valid', () => {
    const req: any = { body: { name: 'Acme Corp' } };
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when required field is missing', () => {
    const req: any = { body: {} };
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when field fails validation', () => {
    const req: any = { body: { name: 'A' } };
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns fieldErrors in response body', () => {
    const req: any = { body: { name: 'A', email: 'not-an-email' } };
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.any(Object) })
    );
  });

  it('strips unknown fields and passes cleaned body to next', () => {
    const req: any = { body: { name: 'Acme', unknown_field: 'hacked' } };
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.unknown_field).toBeUndefined();
  });
});
