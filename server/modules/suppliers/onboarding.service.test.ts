import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./suppliers.repository', () => ({
  getSupplierById: vi.fn(),
  updateSupplier: vi.fn(),
  insertSupplierActivityLog: vi.fn().mockResolvedValue({ error: null }),
}));

import { getSupplierById, updateSupplier, insertSupplierActivityLog } from './suppliers.repository';
import { transitionOnboardingStatus } from './onboarding.service';

function mockSupplier(status: string) {
  vi.mocked(getSupplierById).mockResolvedValue({
    data: { id: 's-1', name: 'Acme', onboarding_status: status },
    error: null,
  } as any);
  vi.mocked(updateSupplier).mockResolvedValue({
    data: { id: 's-1', onboarding_status: status },
    error: null,
  } as any);
}

describe('transitionOnboardingStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when supplier not found', async () => {
    vi.mocked(getSupplierById).mockResolvedValue({ data: null, error: { message: 'Not found' } } as any);
    const result = await transitionOnboardingStatus('s-x', 'invited', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('not_invited → invited is valid', async () => {
    mockSupplier('not_invited');
    const result = await transitionOnboardingStatus('s-1', 'invited', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('invited → registered is valid', async () => {
    mockSupplier('invited');
    const result = await transitionOnboardingStatus('s-1', 'registered', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('registered → profile_filling is valid', async () => {
    mockSupplier('registered');
    const result = await transitionOnboardingStatus('s-1', 'profile_filling', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('profile_filling → submitted is valid', async () => {
    mockSupplier('profile_filling');
    const result = await transitionOnboardingStatus('s-1', 'submitted', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('submitted → approved is valid', async () => {
    mockSupplier('submitted');
    const result = await transitionOnboardingStatus('s-1', 'approved', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('submitted → rejected is valid', async () => {
    mockSupplier('submitted');
    const result = await transitionOnboardingStatus('s-1', 'rejected', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('rejected → profile_filling is valid (re-submission path)', async () => {
    mockSupplier('rejected');
    const result = await transitionOnboardingStatus('s-1', 'profile_filling', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('invited → approved is invalid (skips steps)', async () => {
    mockSupplier('invited');
    const result = await transitionOnboardingStatus('s-1', 'approved', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('approved → any is invalid (terminal state)', async () => {
    mockSupplier('approved');
    const result = await transitionOnboardingStatus('s-1', 'invited', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('writes activity log on successful transition', async () => {
    mockSupplier('not_invited');
    await transitionOnboardingStatus('s-1', 'invited', 'user-1');
    expect(insertSupplierActivityLog).toHaveBeenCalledOnce();
  });

  it('returns error when update fails', async () => {
    vi.mocked(getSupplierById).mockResolvedValue({
      data: { id: 's-1', name: 'Acme', onboarding_status: 'not_invited' },
      error: null,
    } as any);
    vi.mocked(updateSupplier).mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    } as any);
    const result = await transitionOnboardingStatus('s-1', 'invited', 'user-1');
    expect(result.ok).toBe(false);
  });
});
