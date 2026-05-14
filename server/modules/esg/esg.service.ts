import type {
  EsgAssessmentCreate,
  EsgAssessmentResponse,
  EsgAssessmentRow,
} from "./esg.schema";
import {
  fetchApprovedAssessmentRowsForSummary,
  fetchAssessmentHistoryBySupplier,
  fetchEsgPortfolioSummaryFromRPC,
  fetchLatestAssessmentBySupplier,
  fetchLeaderboardAssessmentRows,
  insertEsgAssessmentRecord,
} from "./esg.repository";
import { generateEsgNarrative } from "../suppliers/narrative.service";

type EsgAvgScoreKey = keyof Pick<
  EsgAssessmentRow,
  'overall_esg_score' | 'env_score' | 'social_score' | 'gov_score'
>;

type EsgNumericMetricKey = keyof Pick<
  EsgAssessmentRow,
  | 'renewable_energy_pct'
  | 'waste_recycling_pct'
  | 'carbon_footprint_tons'
  | 'water_usage_m3'
  | 'women_in_mgmt_pct'
  | 'lost_time_injury_rate'
  | 'data_breach_incidents'
>;

type EsgBooleanMetricKey = keyof Pick<
  EsgAssessmentRow,
  | 'living_wage_compliant'
  | 'child_labor_policy'
  | 'anti_corruption_policy'
  | 'independent_audit'
  | 'gdpr_compliant'
>;

// ─── Scoring Engine ────────────────────────────────────────────────────────────
const CURRENT_SCORING_VERSION = "v1";
const CURRENT_WEIGHTS = { env: 0.50, social: 0.20, gov: 0.30 } as const;

function scoreEnvironmental(row: EsgAssessmentCreate): number {
  const points: number[] = [];

  if (row.renewable_energy_pct != null)
    points.push(row.renewable_energy_pct);

  if (row.waste_recycling_pct != null)
    points.push(row.waste_recycling_pct);

  if (row.carbon_footprint_tons != null) {
    const score = Math.max(0, 100 - (row.carbon_footprint_tons / 10));
    points.push(Math.min(100, score));
  }

  if (points.length === 0) return 0;
  const certBonus = Math.min(20, (row.env_certifications?.length ?? 0) * 5);
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  return Math.min(100, Math.round(avg + certBonus));
}

function scoreSocial(row: EsgAssessmentCreate): number {
  const points: number[] = [];

  if (row.women_in_mgmt_pct != null)
    points.push(row.women_in_mgmt_pct);

  if (row.lost_time_injury_rate != null) {
    const score = Math.max(0, 100 - row.lost_time_injury_rate * 20);
    points.push(score);
  }

  if (row.living_wage_compliant === true) points.push(100);
  if (row.living_wage_compliant === false) points.push(0);

  if (row.child_labor_policy === true) points.push(100);
  if (row.child_labor_policy === false) points.push(0);

  if (points.length === 0) return 0;
  const certBonus = Math.min(20, (row.social_certifications?.length ?? 0) * 5);
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  return Math.min(100, Math.round(avg + certBonus));
}

function scoreGovernance(row: EsgAssessmentCreate): number {
  const points: number[] = [];

  if (row.anti_corruption_policy === true) points.push(100);
  if (row.anti_corruption_policy === false) points.push(0);

  if (row.independent_audit === true) points.push(100);
  if (row.independent_audit === false) points.push(0);

  if (row.gdpr_compliant === true) points.push(100);
  if (row.gdpr_compliant === false) points.push(0);

  if (row.data_breach_incidents != null) {
    const score = Math.max(0, 100 - row.data_breach_incidents * 25);
    points.push(score);
  }

  if (points.length === 0) return 0;
  const certBonus = Math.min(20, (row.gov_certifications?.length ?? 0) * 5);
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  return Math.min(100, Math.round(avg + certBonus));
}

export function computeEsgScores(data: EsgAssessmentCreate) {
  const env_score = scoreEnvironmental(data);
  const social_score = scoreSocial(data);
  const gov_score = scoreGovernance(data);
  const overall_esg_score = Math.round(
    env_score * CURRENT_WEIGHTS.env +
    social_score * CURRENT_WEIGHTS.social +
    gov_score * CURRENT_WEIGHTS.gov
  );
  return {
    env_score,
    social_score,
    gov_score,
    overall_esg_score,
    scoring_version: CURRENT_SCORING_VERSION,
    scoring_weights: CURRENT_WEIGHTS,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function avgScoreColumn(rows: EsgAssessmentRow[], key: EsgAvgScoreKey): number {
  return Math.round(rows.reduce((s, r) => s + (r[key] ?? 0), 0) / rows.length);
}

function avgOf(rows: EsgAssessmentRow[], key: EsgNumericMetricKey): number | null {
  const vals = rows
    .map((r) => r[key])
    .filter((v): v is number => v != null && typeof v === 'number');
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function pctTrue(rows: EsgAssessmentRow[], key: EsgBooleanMetricKey): string | null {
  const defined = rows.filter((r) => r[key] != null);
  if (defined.length === 0) return null;
  const trueCount = defined.filter((r) => r[key] === true).length;
  return `${Math.round((trueCount / defined.length) * 100)}%`;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getEsgSummary() {
  const summary = await fetchEsgPortfolioSummaryFromRPC();
  const total = Number(summary.total ?? 0);

  if (total === 0) {
    return {
      avg_esg: 0, avg_env: 0, avg_social: 0, avg_gov: 0, total: 0,
      env_metrics: { avg_renewable_energy_pct: null, avg_waste_recycling_pct: null, avg_carbon_footprint_tons: null, avg_water_usage_m3: null },
      social_metrics: { avg_women_in_mgmt_pct: null, avg_lost_time_injury_rate: null, living_wage_compliant_pct: null, child_labor_policy_pct: null },
      gov_metrics: { anti_corruption_policy_pct: null, independent_audit_pct: null, gdpr_compliant_pct: null, avg_data_breach_incidents: null },
    };
  }

  const pct = (value: number | null) => (value == null ? null : `${Math.round(value)}%`);

  return {
    avg_esg: Math.round(summary.avg_esg ?? 0),
    avg_env: Math.round(summary.avg_env ?? 0),
    avg_social: Math.round(summary.avg_social ?? 0),
    avg_gov: Math.round(summary.avg_gov ?? 0),
    total,

    // Environmental pillar detail
    env_metrics: {
      avg_renewable_energy_pct: summary.avg_renewable_energy_pct,
      avg_waste_recycling_pct: summary.avg_waste_recycling_pct,
      avg_carbon_footprint_tons: summary.avg_carbon_footprint_tons,
      avg_water_usage_m3: summary.avg_water_usage_m3,
    },

    // Social pillar detail
    social_metrics: {
      avg_women_in_mgmt_pct: summary.avg_women_in_mgmt_pct,
      avg_lost_time_injury_rate: summary.avg_lost_time_injury_rate,
      living_wage_compliant_pct: pct(summary.living_wage_pct),
      child_labor_policy_pct: pct(summary.child_labor_policy_pct),
    },

    // Governance pillar detail
    gov_metrics: {
      anti_corruption_policy_pct: pct(summary.anti_corruption_pct),
      independent_audit_pct: pct(summary.independent_audit_pct),
      gdpr_compliant_pct: pct(summary.gdpr_compliant_pct),
      avg_data_breach_incidents: summary.avg_data_breach_incidents,
    },
  };
}

export async function getEsgBySupplier(
  supplierId: string
): Promise<EsgAssessmentResponse | null> {
  const data = await fetchLatestAssessmentBySupplier(supplierId);
  if (!data) return null;
  const row = data as EsgAssessmentRow;
  return {
    ...(data as unknown as EsgAssessmentResponse),
    narrative: generateEsgNarrative(row),
  };
}

export async function getAssessmentHistory(supplierId: string) {
  const { data, error } = await fetchAssessmentHistoryBySupplier(supplierId);
  if (error) throw error;
  return data ?? [];
}

export async function createEsgAssessment(
  supplierId: string,
  userId: string,
  body: EsgAssessmentCreate
) {
  const scores = computeEsgScores(body);

  return insertEsgAssessmentRecord({
    supplier_id: supplierId,
    assessed_by: userId,
    ...body,
    ...scores,
  });
}

type LeaderboardRowRaw = {
  supplier_id: string;
  overall_esg_score: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
  env_certifications: string[] | null;
  social_certifications: string[] | null;
  gov_certifications: string[] | null;
  assessment_date: string;
  srm_suppliers: { name: string; industry: string | null };
};

export async function getEsgLeaderboard() {
  const data = await fetchLeaderboardAssessmentRows();

  const seen = new Set<string>();
  const deduped = (data ?? []).filter((row: LeaderboardRowRaw) => {
    if (seen.has(row.supplier_id)) return false;
    seen.add(row.supplier_id);
    return true;
  });

  return deduped.map((row) => ({
    ...row,
    industry: row.srm_suppliers?.industry ?? null,
  }));
}

// ─── Hotspots (worst gaps vs targets) ─────────────────────────────────────────

export interface HotspotMetric {
  key: string;
  label: string;
  pillar: "E" | "S" | "G";
  avg: number | null;
  target: number;
  below_target_count: number;
  unit: string;
}

type HotspotDef = {
  key: string;
  label: string;
  pillar: "E" | "S" | "G";
  target: number;
  inverted: boolean;
  unit: string;
  kind: "numeric" | "boolean_pct";
};

const HOTSPOT_DEFS: HotspotDef[] = [
  { key: "renewable_energy_pct", label: "Renewable Energy", pillar: "E", target: 70, inverted: false, unit: "%", kind: "numeric" },
  { key: "waste_recycling_pct", label: "Waste Recycling", pillar: "E", target: 60, inverted: false, unit: "%", kind: "numeric" },
  { key: "carbon_footprint_tons", label: "Carbon Footprint", pillar: "E", target: 500, inverted: true, unit: "t", kind: "numeric" },
  { key: "women_in_mgmt_pct", label: "Women in Management", pillar: "S", target: 40, inverted: false, unit: "%", kind: "numeric" },
  { key: "lost_time_injury_rate", label: "Lost Time Injury Rate", pillar: "S", target: 1.0, inverted: true, unit: "", kind: "numeric" },
  { key: "living_wage_compliant", label: "Living Wage Compliance", pillar: "S", target: 80, inverted: false, unit: "%", kind: "boolean_pct" },
  { key: "anti_corruption_policy", label: "Anti-Corruption Policy", pillar: "G", target: 80, inverted: false, unit: "%", kind: "boolean_pct" },
  { key: "independent_audit", label: "Independent Audit", pillar: "G", target: 80, inverted: false, unit: "%", kind: "boolean_pct" },
  { key: "gdpr_compliant", label: "GDPR Compliance", pillar: "G", target: 90, inverted: false, unit: "%", kind: "boolean_pct" },
  { key: "data_breach_incidents", label: "Data Breach Incidents", pillar: "G", target: 0, inverted: true, unit: "", kind: "numeric" },
];

function pctTrueNumber(rows: EsgAssessmentRow[], key: EsgBooleanMetricKey): number | null {
  const defined = rows.filter((r) => r[key] != null);
  if (defined.length === 0) return null;
  const trueCount = defined.filter((r) => r[key] === true).length;
  return Math.round((trueCount / defined.length) * 1000) / 10;
}

function belowTargetCount(
  rows: EsgAssessmentRow[],
  def: HotspotDef
): number {
  switch (def.key) {
    case "renewable_energy_pct":
      return rows.filter((r) => r.renewable_energy_pct != null && r.renewable_energy_pct < def.target).length;
    case "waste_recycling_pct":
      return rows.filter((r) => r.waste_recycling_pct != null && r.waste_recycling_pct < def.target).length;
    case "carbon_footprint_tons":
      return rows.filter((r) => r.carbon_footprint_tons != null && r.carbon_footprint_tons > def.target).length;
    case "women_in_mgmt_pct":
      return rows.filter((r) => r.women_in_mgmt_pct != null && r.women_in_mgmt_pct < def.target).length;
    case "lost_time_injury_rate":
      return rows.filter((r) => r.lost_time_injury_rate != null && r.lost_time_injury_rate > def.target).length;
    case "living_wage_compliant":
      return rows.filter((r) => r.living_wage_compliant === false).length;
    case "anti_corruption_policy":
      return rows.filter((r) => r.anti_corruption_policy === false).length;
    case "independent_audit":
      return rows.filter((r) => r.independent_audit === false).length;
    case "gdpr_compliant":
      return rows.filter((r) => r.gdpr_compliant === false).length;
    case "data_breach_incidents":
      return rows.filter((r) => r.data_breach_incidents != null && r.data_breach_incidents > def.target).length;
    default:
      return 0;
  }
}

export async function getEsgHotspots(): Promise<HotspotMetric[]> {
  const data = await fetchApprovedAssessmentRowsForSummary();
  const rows: EsgAssessmentRow[] = (data ?? []) as EsgAssessmentRow[];
  if (rows.length === 0) return [];

  const scored: { def: HotspotDef; avg: number | null; gap: number; below_target_count: number }[] = [];

  for (const def of HOTSPOT_DEFS) {
    let avg: number | null;
    if (def.kind === "numeric") {
      const k = def.key as EsgNumericMetricKey;
      avg = avgOf(rows, k);
    } else {
      const k = def.key as EsgBooleanMetricKey;
      avg = pctTrueNumber(rows, k);
    }

    const gap = avg == null || Number.isNaN(avg) ? 0 : Math.abs(avg - def.target);
    scored.push({
      def,
      avg,
      gap,
      below_target_count: belowTargetCount(rows, def),
    });
  }

  scored.sort((a, b) => b.gap - a.gap);
  return scored.slice(0, 5).map(({ def, avg, below_target_count }) => ({
    key: def.key,
    label: def.label,
    pillar: def.pillar,
    avg,
    target: def.target,
    below_target_count,
    unit: def.unit,
  }));
}
