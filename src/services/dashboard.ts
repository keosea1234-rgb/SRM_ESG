import { apiGet } from "../lib/api";

export interface DashboardEsgSlice {
  avg_esg: number;
  avg_env: number;
  avg_social: number;
  avg_gov: number;
  total: number;
}

export interface DashboardStats {
  totalSuppliers: number;
  activeSuppliers: number;
  highRiskCount: number;
  expiringDocsCount: number;
  avgPerformanceScore: string | null;
  performanceBands: { high: number; medium: number; low: number };
  esg?: DashboardEsgSlice;
  esgBands: { compliant: number; developing: number; non_compliant: number };
  recentActivities: {
    id: string;
    action_type: string;
    description: string;
    performed_at: string;
  }[];
  topSuppliers: {
    id: string;
    name: string;
    latest_score: number | null;
    current_risk_level: string | null;
    contract_count: number;
    overall_esg_score?: number | null;
  }[];
  decliningSuppliers: {
    id: string;
    name: string;
    latest_score: number;
    previous_score: number;
  }[];
  sparklineData: {
    snapshot_date: string;
    avg_performance_score: number | null;
    high_risk_count: number;
    total_suppliers: number;
  }[];
  vsLastMonth: {
    suppliersChange: number | null;
    performanceChange: number | null;
    riskChange: number | null;
  } | null;
  riskHeatmap?: { industry: string; risk_type: string; avg_score: number }[];
}

/** Response shape from GET /api/dashboard/overview (includes `esg`). */
export type DashboardOverview = DashboardStats & { esg: DashboardEsgSlice };

export async function fetchDashboardStats(industry?: string): Promise<DashboardOverview> {
  const qs = industry ? `?industry=${encodeURIComponent(industry)}` : "";
  return apiGet<DashboardOverview>(`/api/dashboard/overview${qs}`);
}
