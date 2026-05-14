import logger from "../../shared/logger";
import {
  getUnreadAlerts,
  hasAlertForToday,
  hasUnreadAlert,
  insertAlert,
  markAsRead,
  type AlertType,
} from "./alerts.repository";
import { supabase } from "../../db/supabaseClient";

const RISK_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

async function createDailyAlertIfMissing(params: {
  supplierId: string;
  alertType: "esg_threshold_crossed" | "cert_expiring" | "risk_spike" | "supplier_inactivity";
  severity: "high" | "medium" | "low";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const exists = await hasAlertForToday(params.supplierId, params.alertType);
  if (exists) return false;
  await insertAlert({
    supplier_id: params.supplierId,
    alert_type: params.alertType,
    severity: params.severity,
    message: params.message,
    metadata: params.metadata,
  });
  return true;
}

export async function checkAndCreateAlerts(supplierId: string): Promise<{ created: number }> {
  let created = 0;

  const [{ data: esgRows, error: esgError }, { data: docs, error: docsError }, { data: riskRows, error: riskError }] =
    await Promise.all([
      supabase
        .from("srm_esg_assessments")
        .select("overall_esg_score, assessment_date, status")
        .eq("supplier_id", supplierId)
        .eq("status", "approved")
        .order("assessment_date", { ascending: false })
        .limit(2),
      supabase
        .from("srm_supplier_documents")
        .select("id, expiry_date")
        .eq("supplier_id", supplierId)
        .gte("expiry_date", new Date().toISOString())
        .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString()),
      supabase
        .from("srm_risk_assessments")
        .select("overall_risk_level, assessment_date")
        .eq("supplier_id", supplierId)
        .order("assessment_date", { ascending: false })
        .limit(2),
    ]);

  if (esgError) throw esgError;
  if (docsError) throw docsError;
  if (riskError) throw riskError;

  // ESG threshold crossed: latest < 40 and previous >= 40
  if ((esgRows ?? []).length >= 2) {
    const latest = Number(esgRows?.[0]?.overall_esg_score ?? NaN);
    const previous = Number(esgRows?.[1]?.overall_esg_score ?? NaN);
    if (!Number.isNaN(latest) && !Number.isNaN(previous) && latest < 40 && previous >= 40) {
      const inserted = await createDailyAlertIfMissing({
        supplierId,
        alertType: "esg_threshold_crossed",
        severity: "high",
        message: `ESG score crossed below threshold (${previous.toFixed(0)} -> ${latest.toFixed(0)}).`,
        metadata: { previous, latest },
      });
      if (inserted) created += 1;
    }
  }

  // Cert expiring within 30 days
  const expiringCount = (docs ?? []).length;
  if (expiringCount > 0) {
    const severity = expiringCount >= 3 ? "high" : "medium";
    const inserted = await createDailyAlertIfMissing({
      supplierId,
      alertType: "cert_expiring",
      severity,
      message: `${expiringCount} supplier document(s) expire within 30 days.`,
      metadata: { count: expiringCount },
    });
    if (inserted) created += 1;
  }

  // Risk spike
  if ((riskRows ?? []).length >= 2) {
    const latestLevel = String(riskRows?.[0]?.overall_risk_level ?? "").toLowerCase();
    const previousLevel = String(riskRows?.[1]?.overall_risk_level ?? "").toLowerCase();
    const delta = (RISK_RANK[latestLevel] ?? 0) - (RISK_RANK[previousLevel] ?? 0);
    if (delta > 0) {
      const severity = latestLevel === "critical" ? "high" : latestLevel === "high" ? "medium" : "low";
      const inserted = await createDailyAlertIfMissing({
        supplierId,
        alertType: "risk_spike",
        severity,
        message: `Risk level increased from ${previousLevel} to ${latestLevel}.`,
        metadata: { previousLevel, latestLevel },
      });
      if (inserted) created += 1;
    }
  }

  // Supplier inactivity (90 days no activity)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: activityCount, error: activityError } = await supabase
    .from("srm_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .gte("performed_at", ninetyDaysAgo);
  if (activityError) throw activityError;
  if ((activityCount ?? 0) === 0) {
    const inserted = await createDailyAlertIfMissing({
      supplierId,
      alertType: "supplier_inactivity",
      severity: "low",
      message: "No supplier activity recorded in the past 90 days.",
      metadata: { days: 90 },
    });
    if (inserted) created += 1;
  }

  return { created };
}

/** Aggregate 0–100 from five 1–5 pillar scores (higher = riskier). */
function riskAssessmentScorePct(row: {
  financial_risk: number;
  operational_risk: number;
  compliance_risk: number;
  geopolitical_risk: number;
  reputational_risk: number;
}): number {
  const sum =
    Number(row.financial_risk) +
    Number(row.operational_risk) +
    Number(row.compliance_risk) +
    Number(row.geopolitical_risk) +
    Number(row.reputational_risk);
  return (sum / 25) * 100;
}

function addDaysIso(snapshotDate: string, days: number): string {
  const d = new Date(`${snapshotDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

async function insertSnapshotAlertIfUnreadMissing(params: {
  supplierId: string;
  alert_type: AlertType;
  severity: "high" | "medium" | "low";
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (await hasUnreadAlert(params.supplierId, params.alert_type)) return false;
  await insertAlert({
    supplier_id: params.supplierId,
    alert_type: params.alert_type,
    severity: params.severity,
    message: params.message,
    metadata: params.metadata,
  });
  return true;
}

/**
 * After a daily portfolio snapshot is written: evaluate suppliers for ESG decline,
 * high latest risk aggregate, and soon-expiring active contracts. Dedupes by
 * supplier_id + alert_type where an unread row already exists.
 */
export async function runPostSnapshotAlerts(snapshotDate: string): Promise<{ created: number }> {
  let created = 0;

  const { data: esgRows, error: esgErr } = await supabase
    .from("srm_esg_assessments")
    .select("supplier_id, overall_esg_score, assessment_date")
    .eq("status", "approved")
    .order("assessment_date", { ascending: false });
  if (esgErr) throw esgErr;

  const esgLatestTwo = new Map<string, number[]>();
  for (const row of esgRows ?? []) {
    const sid = row.supplier_id as string;
    if (row.overall_esg_score == null) continue;
    const arr = esgLatestTwo.get(sid) ?? [];
    if (arr.length < 2) {
      arr.push(Number(row.overall_esg_score));
      esgLatestTwo.set(sid, arr);
    }
  }
  for (const [supplierId, scores] of esgLatestTwo) {
    if (scores.length < 2) continue;
    const [latest, previous] = scores;
    if (Number.isNaN(latest) || Number.isNaN(previous)) continue;
    if (previous - latest > 10) {
      const inserted = await insertSnapshotAlertIfUnreadMissing({
        supplierId,
        alert_type: "esg_score_decline",
        severity: "high",
        message: `ESG overall score dropped by more than 10 points (${previous.toFixed(0)} → ${latest.toFixed(0)}).`,
        metadata: { previous, latest, snapshot_date: snapshotDate },
      });
      if (inserted) created += 1;
    }
  }

  const { data: riskRows, error: riskErr } = await supabase
    .from("srm_risk_assessments")
    .select(
      "supplier_id, financial_risk, operational_risk, compliance_risk, geopolitical_risk, reputational_risk, assessment_date"
    )
    .order("assessment_date", { ascending: false });
  if (riskErr) throw riskErr;

  const latestRiskBySupplier = new Map<
    string,
    {
      financial_risk: number;
      operational_risk: number;
      compliance_risk: number;
      geopolitical_risk: number;
      reputational_risk: number;
    }
  >();
  for (const row of riskRows ?? []) {
    const sid = row.supplier_id as string;
    if (latestRiskBySupplier.has(sid)) continue;
    latestRiskBySupplier.set(sid, {
      financial_risk: Number(row.financial_risk),
      operational_risk: Number(row.operational_risk),
      compliance_risk: Number(row.compliance_risk),
      geopolitical_risk: Number(row.geopolitical_risk),
      reputational_risk: Number(row.reputational_risk),
    });
  }
  for (const [supplierId, row] of latestRiskBySupplier) {
    const pct = riskAssessmentScorePct(row);
    if (pct > 75) {
      const inserted = await insertSnapshotAlertIfUnreadMissing({
        supplierId,
        alert_type: "high_risk_assessment",
        severity: "high",
        message: `Latest risk assessment aggregate score is ${pct.toFixed(0)} (threshold 75).`,
        metadata: { risk_score_pct: pct, snapshot_date: snapshotDate },
      });
      if (inserted) created += 1;
    }
  }

  const windowEnd = addDaysIso(snapshotDate, 30);
  const { data: contractRows, error: contractErr } = await supabase
    .from("contracts")
    .select("id, supplier_id, expiration_date, title")
    .eq("status", "active")
    .not("supplier_id", "is", null)
    .gte("expiration_date", snapshotDate)
    .lte("expiration_date", windowEnd);
  if (contractErr) throw contractErr;

  const contractsBySupplier = new Map<
    string,
    { id: string; supplier_id: string; expiration_date: string; title: string }[]
  >();
  for (const c of contractRows ?? []) {
    const sid = c.supplier_id as string;
    const list = contractsBySupplier.get(sid) ?? [];
    list.push(c as { id: string; supplier_id: string; expiration_date: string; title: string });
    contractsBySupplier.set(sid, list);
  }
  for (const [supplierId, contracts] of contractsBySupplier) {
    const count = contracts.length;
    const inserted = await insertSnapshotAlertIfUnreadMissing({
      supplierId,
      alert_type: "contract_expiring",
      severity: count >= 2 ? "high" : "medium",
      message:
        count === 1
          ? `Contract "${contracts[0].title}" expires within 30 days (${contracts[0].expiration_date}).`
          : `${count} active contracts expire within 30 days.`,
      metadata: {
        contract_ids: contracts.map((x) => x.id),
        expiration_dates: contracts.map((x) => x.expiration_date),
        snapshot_date: snapshotDate,
      },
    });
    if (inserted) created += 1;
  }

  return { created };
}

export async function listUnreadAlerts(limit = 10) {
  return getUnreadAlerts(limit);
}

export async function markAlertRead(id: string) {
  try {
    await markAsRead(id);
    return { ok: true as const };
  } catch (err: any) {
    logger.error({ err, alertId: id }, "markAlertRead failed");
    return { ok: false as const, error: err?.message ?? "Failed to mark alert as read" };
  }
}
