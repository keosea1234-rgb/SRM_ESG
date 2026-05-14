import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./dashboard.repository', () => ({
  getAllSupplierStats: vi.fn(),
  getHighRiskCount: vi.fn(),
  getRecentActivities: vi.fn(),
  getExpiringDocs: vi.fn(),
  getTopSuppliers: vi.fn(),
  getDecliningSuppliers: vi.fn(),
  getSparklineData: vi.fn(),
  getPerformanceBands: vi.fn(),
  getEsgBands: vi.fn(),
}));

vi.mock('../esg/esg.service', () => ({
  getEsgSummary: vi.fn(),
}));

vi.mock('../risk/risk.repository', () => ({
  getRiskHeatmapData: vi.fn().mockResolvedValue([]),
}));

import * as repo from './dashboard.repository';
import { getEsgSummary } from '../esg/esg.service';
import { getDashboardOverview } from './dashboard.service';

const mockSupplierRows = [
  { id: 's-1', status: 'active' },
  { id: 's-2', status: 'active' },
  { id: 's-3', status: 'inactive' },
];

const mockTopSuppliers = [
  { id: 's-1', name: 'Acme', latest_score: 8.0 },
  { id: 's-2', name: 'Beta', latest_score: 7.6 },
];

const mockHighRiskRows = [{ id: 's-5' }, { id: 's-6' }, { id: 's-7' }, { id: 's-8' }, { id: 's-9' }];

function mockAllRepo() {
  vi.mocked(repo.getAllSupplierStats).mockResolvedValue({ data: mockSupplierRows, error: null } as any);
  vi.mocked(repo.getHighRiskCount).mockResolvedValue({ data: mockHighRiskRows, error: null } as any);
  vi.mocked(repo.getRecentActivities).mockResolvedValue({ data: [], error: null } as any);
  vi.mocked(repo.getExpiringDocs).mockResolvedValue({ data: [{ id: 'd-1' }, { id: 'd-2' }, { id: 'd-3' }], error: null } as any);
  vi.mocked(repo.getTopSuppliers).mockResolvedValue({ data: mockTopSuppliers, error: null } as any);
  vi.mocked(repo.getDecliningSuppliers).mockResolvedValue({ data: [], error: null } as any);
  vi.mocked(repo.getSparklineData).mockResolvedValue({ data: [], error: null } as any);
  vi.mocked(repo.getPerformanceBands).mockResolvedValue({
    data: { high: 1, medium: 2, low: 3 },
    error: null,
  } as any);
  vi.mocked(repo.getEsgBands).mockResolvedValue({
    data: { compliant: 10, developing: 5, non_compliant: 2 },
    error: null,
  } as any);
  vi.mocked(getEsgSummary).mockResolvedValue({ avg_esg: 65, avg_env: 60, avg_social: 70, avg_gov: 66, total: 30 } as any);
}

describe('getDashboardOverview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok:true on success', async () => {
    mockAllRepo();
    const result = await getDashboardOverview();
    expect(result.ok).toBe(true);
  });

  it('returns ok:false when supplier query fails', async () => {
    mockAllRepo();
    vi.mocked(repo.getAllSupplierStats).mockResolvedValue({ data: null, error: { message: 'DB error' } } as any);
    const result = await getDashboardOverview();
    expect(result.ok).toBe(false);
  });

  it('counts totalSuppliers from rows array length', async () => {
    mockAllRepo();
    const result = await getDashboardOverview();
    if (result.ok) expect(result.data.totalSuppliers).toBe(3);
  });

  it('counts only active suppliers', async () => {
    mockAllRepo();
    const result = await getDashboardOverview();
    if (result.ok) expect(result.data.activeSuppliers).toBe(2);
  });

  it('counts highRiskCount from array length', async () => {
    mockAllRepo();
    const result = await getDashboardOverview();
    if (result.ok) expect(result.data.highRiskCount).toBe(5);
  });

  it('calculates avgPerformanceScore from topSuppliers', async () => {
    mockAllRepo();
    const result = await getDashboardOverview();
    if (result.ok) expect(result.data.avgPerformanceScore).toBe('7.8');
  });

  it('returns null avgPerformanceScore when no top suppliers', async () => {
    mockAllRepo();
    vi.mocked(repo.getTopSuppliers).mockResolvedValue({ data: [], error: null } as any);
    const result = await getDashboardOverview();
    if (result.ok) expect(result.data.avgPerformanceScore).toBeNull();
  });

  it('handles zero suppliers gracefully', async () => {
    mockAllRepo();
    vi.mocked(repo.getAllSupplierStats).mockResolvedValue({ data: [], error: null } as any);
    const result = await getDashboardOverview();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalSuppliers).toBe(0);
      expect(result.data.activeSuppliers).toBe(0);
    }
  });
});
