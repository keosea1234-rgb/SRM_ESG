// Encapsulates dashboard data access operations.
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../db/supabaseClient";

type RepositoryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

export interface SupplierStatusRow {
  id: string;
  status: string | null;
}

export interface ActivityRow {
  [key: string]: unknown;
}

export interface TopSupplierRow {
  id: string;
  name: string | null;
  latest_score: number | null;
  current_risk_level: string | null;
  contract_count: number | null;
  /** Latest assessment overall score (0–100), aligned with ESG service formula */
  overall_esg_score: number | null;
}

async function fetchLatestOverallEsgScoresForSupplierIds(
  ids: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (ids.length === 0) return result;

  const { data, error } = await supabase
    .from("srm_esg_assessments")
    .select("supplier_id, overall_esg_score, assessment_date")
    .in("supplier_id", ids);

  if (error || !data) return result;

  const bestBySupplier = new Map<string, { date: string; score: number | null }>();
  for (const row of data) {
    const sid = row.supplier_id as string;
    const d = String(row.assessment_date ?? "");
    const raw = row.overall_esg_score;
    const score =
      raw != null && raw !== ""
        ? Number(raw)
        : null;
    const numScore = score != null && !Number.isNaN(score) ? score : null;
    const prev = bestBySupplier.get(sid);
    if (!prev || d > prev.date) {
      bestBySupplier.set(sid, { date: d, score: numScore });
    }
  }
  for (const [sid, v] of bestBySupplier) {
    result.set(sid, v.score);
  }
  return result;
}

// Gets supplier id and onboarding_status rows used for aggregate supplier stats.
export async function getAllSupplierStats(industry?: string): Promise<RepositoryResult<SupplierStatusRow[]>> {
  let query = supabase.from("v_supplier_summary").select("id, onboarding_status");
  if (industry && industry !== "all") {
    query = query.eq("industry", industry);
  }
  const { data, error } = await query;
  return {
    data: (data as { id: string; onboarding_status: string | null }[] | null)?.map((r) => ({
      id: r.id,
      status: r.onboarding_status,
    })) ?? [],
    error,
  };
}

// Counts suppliers whose summary row shows high or critical current risk (optionally by industry).
export async function getHighRiskCount(industry?: string): Promise<RepositoryResult<{ id: string }[]>> {
  let query = supabase
    .from("v_supplier_summary")
    .select("id, current_risk_level")
    .in("current_risk_level", ["high", "critical"]);
  if (industry && industry !== "all") {
    query = query.eq("industry", industry);
  }
  const { data, error } = await query;
  if (error) return { data: [], error };
  const highRisk = (data ?? []).map((r) => ({ id: r.id }));
  return { data: highRisk, error: null };
}

// Gets recent activity log entries ordered by newest first.
export async function getRecentActivities(): Promise<RepositoryResult<ActivityRow[]>> {
  const { data, error } = await supabase
    .from("srm_activity_log")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(10);
  return { data: (data as ActivityRow[] | null) ?? [], error };
}

// Gets supplier documents expiring within the next 30 days.
export async function getExpiringDocs(): Promise<RepositoryResult<{ id: string }[]>> {
  const { data, error } = await supabase
    .from("srm_supplier_documents")
    .select("id")
    .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString())
    .gte("expiry_date", new Date().toISOString());
  return { data: (data as { id: string }[] | null) ?? [], error };
}

export async function getTopSuppliers(industry?: string): Promise<RepositoryResult<TopSupplierRow[]>> {
  const { data, error } = await supabase
    .from("mv_supplier_dashboard_summary")
    .select("supplier_id, supplier_name, latest_score, current_risk_level, contract_count")
    .order("latest_score", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) return { data: [], error };

  let rows: TopSupplierRow[] = (data ?? []).map((r) => ({
    id: r.supplier_id,
    name: r.supplier_name,
    latest_score: r.latest_score,
    current_risk_level: r.current_risk_level,
    contract_count: r.contract_count,
    overall_esg_score: null,
  }));

  if (industry && industry !== "all" && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: industryRows, error: indErr } = await supabase
      .from("srm_suppliers")
      .select("id, industry")
      .in("id", ids);
    if (indErr) return { data: [], error: indErr };
    const allowed = new Set(
      (industryRows ?? []).filter((r) => r.industry === industry).map((r) => r.id as string)
    );
    rows = rows.filter((r) => allowed.has(r.id));
  }

  const esgMap = await fetchLatestOverallEsgScoresForSupplierIds(rows.map((r) => r.id));
  rows = rows.map((r) => ({
    ...r,
    overall_esg_score: esgMap.get(r.id) ?? null,
  }));

  return { data: rows, error: null };
}

export async function getDecliningSuppliers(): Promise<RepositoryResult<{ id: string; name: string; latest_score: number; previous_score: number }[]>> {
  const { data, error } = await supabase
    .from('mv_supplier_score_trend')
    .select('supplier_id, supplier_name, latest_score, previous_score')
    .lt('score_delta', 0)
    .order('score_delta', { ascending: true });

  if (error) return { data: [], error };

  const rows = (data ?? []).map((r) => ({
    id: r.supplier_id,
    name: r.supplier_name,
    latest_score: r.latest_score,
    previous_score: r.previous_score,
  }));

  return { data: rows, error: null };
}

export interface SnapshotRow {
  snapshot_date: string;
  avg_performance_score: number | null;
  high_risk_count: number;
  total_suppliers: number;
}

export async function getSparklineData(): Promise<RepositoryResult<SnapshotRow[]>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const { data, error } = await supabase
    .from("srm_daily_snapshots")
    .select("snapshot_date, avg_performance_score, high_risk_count, total_suppliers")
    .gte("snapshot_date", thirtyDaysAgo)
    .order("snapshot_date", { ascending: true });
  return { data: (data as SnapshotRow[] | null) ?? [], error };
}

/** Score bands aligned with dashboard UI: ≥7 high, 4–<7 medium, <4 or null → low. */
export interface PerformanceBandsRow {
  high: number;
  medium: number;
  low: number;
}

/** ESG overall score buckets on approved assessments: ≥60 compliant, 30–59 developing, <30 non-compliant. */
export interface EsgBandsRow {
  compliant: number;
  developing: number;
  non_compliant: number;
}

async function supplierIdsForIndustry(industry: string): Promise<RepositoryResult<string[]>> {
  const { data, error } = await supabase.from("srm_suppliers").select("id").eq("industry", industry);
  if (error) return { data: null, error };
  return { data: (data ?? []).map((r) => r.id as string), error: null };
}

export async function getPerformanceBands(industry?: string): Promise<RepositoryResult<PerformanceBandsRow>> {
  let supplierIds: string[] | null = null;
  if (industry && industry !== "all") {
    const idRes = await supplierIdsForIndustry(industry);
    if (idRes.error) return { data: null, error: idRes.error };
    supplierIds = idRes.data ?? [];
    if (supplierIds.length === 0) {
      return { data: { high: 0, medium: 0, low: 0 }, error: null };
    }
  }

  const mvCount = () => {
    let q = supabase
      .from("mv_supplier_dashboard_summary")
      .select("*", { count: "exact", head: true });
    if (supplierIds) q = q.in("supplier_id", supplierIds);
    return q;
  };

  const [highRes, mediumRes, lowRes] = await Promise.all([
    mvCount().gte("latest_score", 7),
    mvCount().gte("latest_score", 4).lt("latest_score", 7),
    mvCount().or("latest_score.lt.4,latest_score.is.null"),
  ]);

  const err = highRes.error ?? mediumRes.error ?? lowRes.error;
  if (err) return { data: null, error: err };

  return {
    data: {
      high: highRes.count ?? 0,
      medium: mediumRes.count ?? 0,
      low: lowRes.count ?? 0,
    },
    error: null,
  };
}

export async function getEsgBands(industry?: string): Promise<RepositoryResult<EsgBandsRow>> {
  let supplierIds: string[] | null = null;
  if (industry && industry !== "all") {
    const idRes = await supplierIdsForIndustry(industry);
    if (idRes.error) return { data: null, error: idRes.error };
    supplierIds = idRes.data ?? [];
    if (supplierIds.length === 0) {
      return { data: { compliant: 0, developing: 0, non_compliant: 0 }, error: null };
    }
  }

  const assessCount = () => {
    let q = supabase
      .from("srm_esg_assessments")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");
    if (supplierIds) q = q.in("supplier_id", supplierIds);
    return q;
  };

  const [compliantRes, developingRes, nonCompliantRes] = await Promise.all([
    assessCount().gte("overall_esg_score", 60),
    assessCount().gte("overall_esg_score", 30).lt("overall_esg_score", 60),
    assessCount().or("overall_esg_score.lt.30,overall_esg_score.is.null"),
  ]);

  const err = compliantRes.error ?? developingRes.error ?? nonCompliantRes.error;
  if (err) return { data: null, error: err };

  return {
    data: {
      compliant: compliantRes.count ?? 0,
      developing: developingRes.count ?? 0,
      non_compliant: nonCompliantRes.count ?? 0,
    },
    error: null,
  };
}
