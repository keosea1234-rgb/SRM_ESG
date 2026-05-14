import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../shared/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { supabase } from '../../db/supabaseClient';
import { compareSuppliersService } from './comparison.controller';

function mockSupabaseChain(data: any) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as any);
  return chain;
}

const mockSummary = {
  id: 's-1',
  name: 'Acme',
  industry: 'Tech',
  status: 'active',
  latest_performance_score: 8,
  current_risk_level: 'low',
  total_value: 100000,
};

describe('compareSuppliersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when more than 5 IDs provided', async () => {
    const result = await compareSuppliersService(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('returns data for 2 valid suppliers', async () => {
    mockSupabaseChain(mockSummary);
    const result = await compareSuppliersService(['s-1', 's-2']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suppliers).toHaveLength(2);
  });

  it('returns data for 5 suppliers (max allowed)', async () => {
    mockSupabaseChain(mockSummary);
    const result = await compareSuppliersService(['s-1', 's-2', 's-3', 's-4', 's-5']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suppliers).toHaveLength(5);
  });

  it('handles supplier with no ESG data — esg fields are null', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: mockSummary, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);
    const result = await compareSuppliersService(['s-1', 's-2']);
    if (result.ok) {
      expect(result.data.suppliers[0].esg.overall).toBeNull();
    }
  });

  it('each supplier row has expected shape', async () => {
    mockSupabaseChain(mockSummary);
    const result = await compareSuppliersService(['s-1', 's-2']);
    if (result.ok) {
      const s = result.data.suppliers[0];
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('esg');
      expect(s).toHaveProperty('performance');
      expect(s).toHaveProperty('risk');
    }
  });

  it('returns data for single supplier (service allows it, route enforces min 2)', async () => {
    mockSupabaseChain(mockSummary);
    const result = await compareSuppliersService(['s-1']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suppliers).toHaveLength(1);
  });
});
