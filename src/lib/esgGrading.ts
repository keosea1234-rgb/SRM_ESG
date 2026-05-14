export type EsgGrade = "A" | "B" | "C" | "D" | "F";

export interface GradeResult {
  grade: EsgGrade;
  score: number; // 0-100 normalize edilmiş
  color: string; // tailwind text class
  bg: string; // tailwind bg class
  label: string;
}

const GRADE_BANDS: { grade: EsgGrade; min: number; color: string; bg: string; label: string }[] = [
  { grade: "A", min: 80, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Excellent" },
  { grade: "B", min: 65, color: "text-teal-700", bg: "bg-teal-50 border-teal-200", label: "Good" },
  { grade: "C", min: 50, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Average" },
  { grade: "D", min: 35, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "Below Average" },
  { grade: "F", min: 0, color: "text-red-700", bg: "bg-red-50 border-red-200", label: "Poor" },
];

export function gradeFromScore(score: number | null): GradeResult | null {
  if (score == null) return null;
  const band = [...GRADE_BANDS].find((b) => score >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
  return { grade: band.grade, score: Math.round(score), color: band.color, bg: band.bg, label: band.label };
}

/** Summary API helper: strings like "75%" → 0–100 score for grading. */
export function pctDisplayToScore(pct: string | null | undefined): number | null {
  if (pct == null || pct === "—") return null;
  const m = String(pct).trim().match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

// Metric normalizers — all return 0-100 or null

export function normalizePct(val: number | null): number | null {
  if (val == null) return null;
  return Math.min(100, Math.max(0, val));
}

export function normalizeCarbon(tons: number | null): number | null {
  if (tons == null) return null;
  // 0t = 100, 1000t = 0, linear
  return Math.min(100, Math.max(0, 100 - tons / 10));
}

export function normalizeInjuryRate(rate: number | null): number | null {
  if (rate == null) return null;
  // 0 = 100, 5+ = 0
  return Math.min(100, Math.max(0, 100 - rate * 20));
}

export function normalizeBoolean(val: boolean | null): number | null {
  if (val == null) return null;
  return val ? 100 : 0;
}

export function normalizeDataBreaches(count: number | null): number | null {
  if (count == null) return null;
  // 0 = 100, 4+ = 0
  return Math.min(100, Math.max(0, 100 - count * 25));
}

// Pillar grade helpers — equal weight across sub-metrics, null metrics excluded

export interface EnvMetricGrades {
  renewable_energy: GradeResult | null;
  waste_recycling: GradeResult | null;
  carbon_footprint: GradeResult | null;
  // water_usage: display only, no grade
}

export interface SocialMetricGrades {
  women_in_mgmt: GradeResult | null;
  injury_rate: GradeResult | null;
  living_wage: GradeResult | null;
  child_labor_policy: GradeResult | null;
}

export interface GovMetricGrades {
  anti_corruption: GradeResult | null;
  independent_audit: GradeResult | null;
  gdpr: GradeResult | null;
  data_breaches: GradeResult | null;
}

export function gradeEnvMetrics(data: {
  renewable_energy_pct: number | null;
  waste_recycling_pct: number | null;
  carbon_footprint_tons: number | null;
}): EnvMetricGrades {
  return {
    renewable_energy: gradeFromScore(normalizePct(data.renewable_energy_pct)),
    waste_recycling: gradeFromScore(normalizePct(data.waste_recycling_pct)),
    carbon_footprint: gradeFromScore(normalizeCarbon(data.carbon_footprint_tons)),
  };
}

export function gradeSocialMetrics(data: {
  women_in_mgmt_pct: number | null;
  lost_time_injury_rate: number | null;
  living_wage_compliant: boolean | null;
  child_labor_policy: boolean | null;
}): SocialMetricGrades {
  return {
    women_in_mgmt: gradeFromScore(normalizePct(data.women_in_mgmt_pct)),
    injury_rate: gradeFromScore(normalizeInjuryRate(data.lost_time_injury_rate)),
    living_wage: gradeFromScore(normalizeBoolean(data.living_wage_compliant)),
    child_labor_policy: gradeFromScore(normalizeBoolean(data.child_labor_policy)),
  };
}

export function gradeGovMetrics(data: {
  anti_corruption_policy: boolean | null;
  independent_audit: boolean | null;
  gdpr_compliant: boolean | null;
  data_breach_incidents: number | null;
}): GovMetricGrades {
  return {
    anti_corruption: gradeFromScore(normalizeBoolean(data.anti_corruption_policy)),
    independent_audit: gradeFromScore(normalizeBoolean(data.independent_audit)),
    gdpr: gradeFromScore(normalizeBoolean(data.gdpr_compliant)),
    data_breaches: gradeFromScore(normalizeDataBreaches(data.data_breach_incidents)),
  };
}
