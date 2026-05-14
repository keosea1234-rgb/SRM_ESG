import { supabase } from "../../db/supabaseClient";
import type { EsgAssessmentRow } from "../esg/esg.schema";

export interface NarrativeSignal {
  type:
    | "esg_decline"
    | "risk_increase"
    | "performance_drop"
    | "cert_expiring"
    | "esg_hotspot"
    | "positive_trend";
  severity: "high" | "medium" | "low";
  message: string;
  delta?: number;
  metric?: string;
}

export interface HealthNarrative {
  supplierId: string;
  generatedAt: string;
  overallSummary: string;
  signals: NarrativeSignal[];
  trendDirection: "improving" | "declining" | "stable";
}

type EsgHistoryRow = {
  overall_esg_score: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
  assessment_date: string;
};

type RiskRow = {
  overall_risk_level: string | null;
  assessment_date: string | null;
};

type PerformanceTrendRow = {
  score_delta: number | null;
};

type ExpiringDocRow = {
  id: string;
  expiry_date: string | null;
};

type LatestEsgRow = {
  renewable_energy_pct: number | null;
  waste_recycling_pct: number | null;
  carbon_footprint_tons: number | null;
  women_in_mgmt_pct: number | null;
  lost_time_injury_rate: number | null;
  living_wage_compliant: boolean | null;
  anti_corruption_policy: boolean | null;
  independent_audit: boolean | null;
  gdpr_compliant: boolean | null;
  data_breach_incidents: number | null;
};

type ActivityRow = {
  action: string | null;
  description: string | null;
  performed_at: string | null;
};

interface NarrativeInput {
  supplierId: string;
  esgHistory: EsgHistoryRow[];
  riskHistory: RiskRow[];
  performanceTrend: PerformanceTrendRow | null;
  expiringDocs: ExpiringDocRow[];
  latestEsg: LatestEsgRow | null;
  recentActivity: ActivityRow[];
}

type HotspotDef = {
  key: keyof LatestEsgRow;
  label: string;
  target: number;
  inverted: boolean;
  kind: "numeric" | "boolean_pct";
};

const HOTSPOT_DEFS: HotspotDef[] = [
  { key: "renewable_energy_pct", label: "Renewable Energy", target: 70, inverted: false, kind: "numeric" },
  { key: "waste_recycling_pct", label: "Waste Recycling", target: 60, inverted: false, kind: "numeric" },
  { key: "carbon_footprint_tons", label: "Carbon Footprint", target: 500, inverted: true, kind: "numeric" },
  { key: "women_in_mgmt_pct", label: "Women in Management", target: 40, inverted: false, kind: "numeric" },
  { key: "lost_time_injury_rate", label: "Lost Time Injury Rate", target: 1, inverted: true, kind: "numeric" },
  { key: "living_wage_compliant", label: "Living Wage Compliance", target: 80, inverted: false, kind: "boolean_pct" },
  { key: "anti_corruption_policy", label: "Anti-Corruption Policy", target: 80, inverted: false, kind: "boolean_pct" },
  { key: "independent_audit", label: "Independent Audit", target: 80, inverted: false, kind: "boolean_pct" },
  { key: "gdpr_compliant", label: "GDPR Compliance", target: 90, inverted: false, kind: "boolean_pct" },
  { key: "data_breach_incidents", label: "Data Breach Incidents", target: 0, inverted: true, kind: "numeric" },
];

const SEVERITY_WEIGHT: Record<NarrativeSignal["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const RISK_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function toPercentForHotspot(def: HotspotDef, value: number | boolean | null): number | null {
  if (value == null) return null;
  if (def.kind === "boolean_pct") return value === true ? 100 : 0;
  return typeof value === "number" ? value : null;
}

function hotspotGap(def: HotspotDef, current: number): number {
  if (def.inverted) {
    if (def.target === 0) return current > 0 ? current * 100 : 0;
    return current <= def.target ? 0 : ((current - def.target) / def.target) * 100;
  }
  if (def.target === 0) return 0;
  return current >= def.target ? 0 : ((def.target - current) / def.target) * 100;
}

function isSevereHotspot(def: HotspotDef, current: number): boolean {
  if (def.inverted) {
    if (def.target === 0) return current > 0;
    return current > def.target * 1.5;
  }
  return current < def.target * 0.5;
}

function formatSignalLabel(type: NarrativeSignal["type"]): string {
  switch (type) {
    case "esg_decline":
      return "ESG deterioration";
    case "risk_increase":
      return "rising risk level";
    case "performance_drop":
      return "performance drop";
    case "cert_expiring":
      return "expiring compliance documents";
    case "esg_hotspot":
      return "critical ESG hotspot";
    case "positive_trend":
      return "positive delivery trend";
    default:
      return "health signal";
  }
}

function buildOverallSummary(signals: NarrativeSignal[]): string {
  if (signals.length === 0) {
    return "Supplier health signals are stable with no major alerts.";
  }
  const top = [...signals]
    .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
    .slice(0, 2);
  if (top.length === 1) return `${formatSignalLabel(top[0].type)} requires attention.`;
  return `${formatSignalLabel(top[0].type)} and ${formatSignalLabel(top[1].type)} require attention.`;
}

export function deriveTrendDirection(signals: NarrativeSignal[], recentActivity: ActivityRow[]): HealthNarrative["trendDirection"] {
  let score = 0;
  for (const signal of signals) {
    const weight = SEVERITY_WEIGHT[signal.severity];
    if (signal.type === "positive_trend") score += weight;
    else score -= weight;
  }

  for (const event of recentActivity) {
    const text = `${event.action ?? ""} ${event.description ?? ""}`.toLowerCase();
    if (/(improv|recover|stabilized|reduced risk|on-time)/.test(text)) score += 1;
    if (/(declin|drop|critical|high risk|delay|breach|expired)/.test(text)) score -= 1;
  }

  if (score >= 2) return "improving";
  if (score <= -2) return "declining";
  return "stable";
}

function joinNarrativeDrivers(phrases: string[]): string {
  const cleaned = phrases.filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function environmentalDrivers(a: EsgAssessmentRow): string[] {
  const d: string[] = [];
  if (a.carbon_footprint_tons != null && a.carbon_footprint_tons > 400) {
    d.push(`a carbon footprint of ${a.carbon_footprint_tons} metric tons`);
  }
  if (a.renewable_energy_pct != null && a.renewable_energy_pct < 35) {
    d.push(`renewable energy at only ${Math.round(a.renewable_energy_pct)}%`);
  }
  if (a.waste_recycling_pct != null && a.waste_recycling_pct < 35) {
    d.push(`waste recycling at ${Math.round(a.waste_recycling_pct)}%`);
  }
  return d;
}

function socialDrivers(a: EsgAssessmentRow): string[] {
  const d: string[] = [];
  if (a.lost_time_injury_rate != null && a.lost_time_injury_rate > 1) {
    d.push(`an elevated lost-time injury rate (${a.lost_time_injury_rate})`);
  }
  if (a.women_in_mgmt_pct != null && a.women_in_mgmt_pct < 30) {
    d.push(`women in management at ${Math.round(a.women_in_mgmt_pct)}%`);
  }
  if (a.living_wage_compliant === false) d.push("living wage compliance gaps");
  if (a.child_labor_policy === false) d.push("no formal child-labor safeguards on file");
  return d;
}

function governanceDrivers(a: EsgAssessmentRow): string[] {
  const d: string[] = [];
  const n = a.data_breach_incidents ?? 0;
  if (n > 0) {
    d.push(n === 1 ? "one recorded data breach incident" : `${n} recorded data breach incidents`);
  }
  if (a.independent_audit === false) d.push("missing independent audit");
  if (a.gdpr_compliant === false) d.push("GDPR assurance gaps");
  if (a.anti_corruption_policy === false) d.push("no anti-corruption policy on file");
  return d;
}

/**
 * One–two sentence narrative for a single ESG assessment: weakest pillar plus concrete drivers
 * (same tone as health narrative signals in this module).
 */
export function generateEsgNarrative(assessment: EsgAssessmentRow): string {
  const pillars: { label: string; score: number }[] = [];
  if (assessment.env_score != null) pillars.push({ label: "Environmental", score: assessment.env_score });
  if (assessment.social_score != null) pillars.push({ label: "Social", score: assessment.social_score });
  if (assessment.gov_score != null) pillars.push({ label: "Governance", score: assessment.gov_score });

  if (pillars.length === 0) {
    return "Environmental, social, and governance pillar scores are not available for this assessment.";
  }

  pillars.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const order = ["Environmental", "Social", "Governance"];
    return order.indexOf(a.label) - order.indexOf(b.label);
  });
  const weakest = pillars[0];

  let drivers: string[] =
    weakest.label === "Environmental"
      ? environmentalDrivers(assessment)
      : weakest.label === "Social"
        ? socialDrivers(assessment)
        : governanceDrivers(assessment);
  drivers = drivers.slice(0, 3);

  const head = `${weakest.label} is the weakest ESG pillar with a score of ${weakest.score.toFixed(0)} out of 100.`;

  if (drivers.length === 0) {
    return `${head} Supporting disclosures are limited or in line with targets on this pillar; review underlying metrics to close the gap.`;
  }

  return `${head} This reflects ${joinNarrativeDrivers(drivers)}.`;
}

export function buildNarrativeFromData(input: NarrativeInput): HealthNarrative {
  const signals: NarrativeSignal[] = [];

  if (input.esgHistory.length >= 2) {
    const latest = input.esgHistory[input.esgHistory.length - 1];
    const previous = input.esgHistory[input.esgHistory.length - 2];
    const latestOverall = latest.overall_esg_score ?? 0;
    const previousOverall = previous.overall_esg_score ?? 0;
    const delta = latestOverall - previousOverall;

    if (delta < -5) {
      const pillarDeltas = [
        { key: "Environmental", value: (latest.env_score ?? 0) - (previous.env_score ?? 0) },
        { key: "Social", value: (latest.social_score ?? 0) - (previous.social_score ?? 0) },
        { key: "Governance", value: (latest.gov_score ?? 0) - (previous.gov_score ?? 0) },
      ].sort((a, b) => a.value - b.value);
      const biggestDrop = pillarDeltas[0];
      signals.push({
        type: "esg_decline",
        severity: delta < -10 ? "high" : "medium",
        message: `ESG score dropped by ${Math.abs(delta).toFixed(1)} points; ${biggestDrop.key} pillar showed the largest decline (${biggestDrop.value.toFixed(1)}).`,
        delta,
        metric: "overall_esg_score",
      });
    }
  }

  if (input.riskHistory.length > 0) {
    const latestRisk = input.riskHistory[0];
    const currentLevel = (latestRisk.overall_risk_level ?? "").toLowerCase();
    if (currentLevel === "critical" || currentLevel === "high") {
      const prev = input.riskHistory[1];
      const prevLevel = (prev?.overall_risk_level ?? "").toLowerCase();
      const delta = (RISK_RANK[currentLevel] ?? 0) - (RISK_RANK[prevLevel] ?? 0);
      const changed =
        prevLevel && delta > 0
          ? ` Risk increased from ${prevLevel} to ${currentLevel}.`
          : "";
      signals.push({
        type: "risk_increase",
        severity: currentLevel === "critical" ? "high" : "medium",
        message: `Current risk level is ${currentLevel}.${changed}`.trim(),
        delta: delta > 0 ? delta : undefined,
        metric: "overall_risk_level",
      });
    }
  }

  const scoreDelta = input.performanceTrend?.score_delta;
  if (typeof scoreDelta === "number") {
    if (scoreDelta < -1) {
      signals.push({
        type: "performance_drop",
        severity: "medium",
        message: `Delivery performance declined by ${Math.abs(scoreDelta).toFixed(1)} points versus previous period.`,
        delta: scoreDelta,
        metric: "score_delta",
      });
    } else if (scoreDelta > 1) {
      signals.push({
        type: "positive_trend",
        severity: "low",
        message: `Delivery performance improved by ${scoreDelta.toFixed(1)} points.`,
        delta: scoreDelta,
        metric: "score_delta",
      });
    }
  }

  if (input.expiringDocs.length > 0) {
    signals.push({
      type: "cert_expiring",
      severity: input.expiringDocs.length >= 3 ? "high" : "medium",
      message: `${input.expiringDocs.length} compliance document(s) expire within 30 days.`,
      delta: input.expiringDocs.length,
      metric: "expiry_date",
    });
  }

  if (input.latestEsg) {
    const candidates = HOTSPOT_DEFS.map((def) => {
      const raw = input.latestEsg?.[def.key] ?? null;
      const normalized = toPercentForHotspot(def, raw);
      if (normalized == null) return null;
      return {
        def,
        current: normalized,
        gap: hotspotGap(def, normalized),
      };
    }).filter((v): v is { def: HotspotDef; current: number; gap: number } => v !== null);

    candidates.sort((a, b) => b.gap - a.gap);
    const biggest = candidates[0];
    if (biggest && isSevereHotspot(biggest.def, biggest.current)) {
      signals.push({
        type: "esg_hotspot",
        severity: "high",
        metric: biggest.def.key,
        delta: Number(biggest.gap.toFixed(1)),
        message: `${biggest.def.label} is critically below target (${biggest.current.toFixed(1)} vs ${biggest.def.target}).`,
      });
    }
  }

  return {
    supplierId: input.supplierId,
    generatedAt: new Date().toISOString(),
    overallSummary: buildOverallSummary(signals),
    signals,
    trendDirection: deriveTrendDirection(signals, input.recentActivity),
  };
}

export async function generateHealthNarrative(supplierId: string): Promise<HealthNarrative> {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const since60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [esgHistoryRes, riskRes, performanceRes, docsRes, latestEsgRes, activityRes] = await Promise.all([
    supabase
      .from("srm_esg_assessments")
      .select("overall_esg_score, env_score, social_score, gov_score, assessment_date")
      .eq("supplier_id", supplierId)
      .eq("status", "approved")
      .order("assessment_date", { ascending: true })
      .limit(12),
    supabase
      .from("srm_risk_assessments")
      .select("overall_risk_level, assessment_date")
      .eq("supplier_id", supplierId)
      .order("assessment_date", { ascending: false })
      .limit(2),
    supabase
      .from("mv_supplier_score_trend")
      .select("score_delta")
      .eq("supplier_id", supplierId)
      .maybeSingle(),
    supabase
      .from("srm_supplier_documents")
      .select("id, expiry_date")
      .eq("supplier_id", supplierId)
      .gte("expiry_date", now.toISOString())
      .lte("expiry_date", in30Days.toISOString()),
    supabase
      .from("srm_esg_assessments")
      .select(
        "renewable_energy_pct, waste_recycling_pct, carbon_footprint_tons, women_in_mgmt_pct, lost_time_injury_rate, living_wage_compliant, anti_corruption_policy, independent_audit, gdpr_compliant, data_breach_incidents",
      )
      .eq("supplier_id", supplierId)
      .eq("status", "approved")
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("srm_activity_log")
      .select("action, description, performed_at")
      .eq("supplier_id", supplierId)
      .gte("performed_at", since60Days.toISOString())
      .order("performed_at", { ascending: false })
      .limit(30),
  ]);

  if (esgHistoryRes.error) throw esgHistoryRes.error;
  if (riskRes.error) throw riskRes.error;
  if (performanceRes.error) throw performanceRes.error;
  if (docsRes.error) throw docsRes.error;
  if (latestEsgRes.error) throw latestEsgRes.error;
  if (activityRes.error) throw activityRes.error;

  return buildNarrativeFromData({
    supplierId,
    esgHistory: (esgHistoryRes.data ?? []) as EsgHistoryRow[],
    riskHistory: (riskRes.data ?? []) as RiskRow[],
    performanceTrend: (performanceRes.data ?? null) as PerformanceTrendRow | null,
    expiringDocs: (docsRes.data ?? []) as ExpiringDocRow[],
    latestEsg: (latestEsgRes.data ?? null) as LatestEsgRow | null,
    recentActivity: (activityRes.data ?? []) as ActivityRow[],
  });
}
