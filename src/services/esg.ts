import { apiGet } from "../lib/api";

interface EnvMetrics {
  avg_renewable_energy_pct: number | null;
  avg_waste_recycling_pct: number | null;
  avg_carbon_footprint_tons: number | null;
  avg_water_usage_m3: number | null;
}

interface SocialMetrics {
  avg_women_in_mgmt_pct: number | null;
  avg_lost_time_injury_rate: number | null;
  living_wage_compliant_pct: string | null;
  child_labor_policy_pct: string | null;
}

interface GovMetrics {
  anti_corruption_policy_pct: string | null;
  independent_audit_pct: string | null;
  gdpr_compliant_pct: string | null;
  avg_data_breach_incidents: number | null;
}

export interface EsgSummary {
  avg_esg: number;
  avg_env: number;
  avg_social: number;
  avg_gov: number;
  total: number;
  env_metrics: EnvMetrics;
  social_metrics: SocialMetrics;
  gov_metrics: GovMetrics;
}

export interface LeaderboardRow {
  supplier_id: string;
  overall_esg_score: number;
  env_score: number;
  social_score: number;
  gov_score: number;
  env_certifications: string[];
  social_certifications: string[];
  gov_certifications: string[];
  srm_suppliers: { name: string; industry: string | null };
  industry?: string | null;
}

export interface HotspotMetric {
  key: string;
  label: string;
  pillar: "E" | "S" | "G";
  avg: number | null;
  target: number;
  below_target_count: number;
  unit: string;
}

export interface EsgHistoryItem {
  id: string;
  period: string;
  assessment_date: string;
  status: string;
  overall_esg_score: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
}

export const fetchEsgSummary = () => apiGet<EsgSummary>("/api/esg/summary");

export const fetchEsgLeaderboard = () => apiGet<LeaderboardRow[]>("/api/esg/leaderboard");

export const fetchEsgHotspots = () => apiGet<HotspotMetric[]>("/api/esg/hotspots");

export async function fetchEsgHistory(supplierId: string): Promise<EsgHistoryItem[]> {
  return apiGet(`/api/esg/${supplierId}/history`);
}
