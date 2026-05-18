// Contains dashboard business logic used by controllers.
import {
  getAllSupplierStats,
  getDecliningSuppliers,
  getEsgBands,
  getEsgKpisForDashboard,
  getExpiringDocs,
  getHighRiskCount,
  getPerformanceBands,
  getRecentActivities,
  getSparklineData,
  getTopSuppliers,
  type SnapshotRow,
  type TopSupplierRow,
} from "./dashboard.repository";
import { getRiskHeatmapData } from "../risk/risk.repository";
import logger from "../../shared/logger";

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export interface DashboardStats {
  totalSuppliers: number;
  activeSuppliers: number;
  highRiskCount: number;
  expiringDocsCount: number;
  avgPerformanceScore: string | null;
  recentActivities: Record<string, unknown>[];
  topSuppliers: TopSupplierRow[];
  decliningSuppliers: { id: string; name: string; latest_score: number; previous_score: number }[];
}

export interface VsLastMonth {
  suppliersChange: number | null;
  performanceChange: number | null;
  riskChange: number | null;
}

export interface DashboardStatsEnriched extends DashboardStats {
  sparklineData: SnapshotRow[];
  vsLastMonth: VsLastMonth;
}

export interface DashboardEsgSlice {
  avg_esg: number;
  avg_env: number;
  avg_social: number;
  avg_gov: number;
  total: number;
}

export interface DashboardOverview {
  totalSuppliers: number;
  activeSuppliers: number;
  highRiskCount: number;
  expiringDocsCount: number;
  avgPerformanceScore: string | null;
  performanceBands: { high: number; medium: number; low: number };
  esg: DashboardEsgSlice;
  esgBands: { compliant: number; developing: number; non_compliant: number };
  recentActivities: Record<string, unknown>[];
  topSuppliers: TopSupplierRow[];
  decliningSuppliers: { id: string; name: string; latest_score: number; previous_score: number }[];
  sparklineData: SnapshotRow[];
  vsLastMonth: VsLastMonth;
  riskHeatmap: { industry: string; risk_type: string; avg_score: number }[];
}

export async function getDashboardOverview(industry?: string): Promise<ServiceResult<DashboardOverview>> {
  const [
    suppliers,
    highRisk,
    activities,
    expiringDocs,
    topSuppliers,
    declining,
    sparkline,
    esgKpis,
    performanceBands,
    esgBands,
    riskHeatmap,
  ] = await Promise.all([
    getAllSupplierStats(industry),
    getHighRiskCount(industry),
    getRecentActivities(),
    getExpiringDocs(industry),
    getTopSuppliers(industry),
    getDecliningSuppliers(industry),
    getSparklineData(),
    getEsgKpisForDashboard(industry),
    getPerformanceBands(industry),
    getEsgBands(industry),
    getRiskHeatmapData().catch((e: unknown) => {
      logger.warn({ err: e }, "risk heatmap unavailable");
      return [];
    }),
  ]);

  if (suppliers.error) return { ok: false, status: 500, error: suppliers.error.message };
  if (highRisk.error) return { ok: false, status: 500, error: highRisk.error.message };
  if (activities.error) return { ok: false, status: 500, error: activities.error.message };
  if (expiringDocs.error) return { ok: false, status: 500, error: expiringDocs.error.message };
  if (topSuppliers.error) return { ok: false, status: 500, error: topSuppliers.error.message };
  if (declining.error) return { ok: false, status: 500, error: declining.error.message };
  if (performanceBands.error)
    return { ok: false, status: 500, error: performanceBands.error.message };
  if (esgBands.error) return { ok: false, status: 500, error: esgBands.error.message };
  if (esgKpis.error) return { ok: false, status: 500, error: esgKpis.error.message };

  if (sparkline.error) logger.warn({ err: sparkline.error }, "dashboard sparkline unavailable");

  const supplierRows = suppliers.data ?? [];
  const totalSuppliers = supplierRows.length;
  const activeSuppliers = supplierRows.filter((s) => s.status === "active").length;

  const scoreValues = (topSuppliers.data ?? [])
    .map((s) => s.latest_score)
    .filter((v): v is number => v != null);

  const avgPerformanceScore =
    scoreValues.length > 0
      ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
      : null;

  const snapshots = industry && industry !== "all" ? [] : (sparkline.data ?? []);
  const first = snapshots[0] ?? null;
  const last = snapshots[snapshots.length - 1] ?? null;

  return {
    ok: true,
    data: {
      totalSuppliers,
      activeSuppliers,
      highRiskCount: (highRisk.data ?? []).length,
      expiringDocsCount: (expiringDocs.data ?? []).length,
      avgPerformanceScore,
      performanceBands: performanceBands.data ?? { high: 0, medium: 0, low: 0 },
      esg: esgKpis.data ?? { avg_esg: 0, avg_env: 0, avg_social: 0, avg_gov: 0, total: 0 },
      esgBands: esgBands.data ?? { compliant: 0, developing: 0, non_compliant: 0 },
      recentActivities: (activities.data ?? []) as Record<string, unknown>[],
      topSuppliers: topSuppliers.data ?? [],
      decliningSuppliers: declining.data ?? [],
      sparklineData: snapshots,
      vsLastMonth: {
        suppliersChange: first && last ? last.total_suppliers - first.total_suppliers : null,
        performanceChange:
          first?.avg_performance_score != null && last?.avg_performance_score != null
            ? Math.round((last.avg_performance_score - first.avg_performance_score) * 10) / 10
            : null,
        riskChange: first && last ? last.high_risk_count - first.high_risk_count : null,
      },
      riskHeatmap,
    },
  };
}
