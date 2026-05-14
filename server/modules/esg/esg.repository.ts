import { supabase } from "../../db/supabaseClient";

/** Approved assessments with columns needed for dashboard ESG summary aggregates. */
export async function fetchApprovedAssessmentRowsForSummary() {
  const { data, error } = await supabase
    .from("srm_esg_assessments")
    .select(`
      overall_esg_score,
      env_score,
      social_score,
      gov_score,
      status,
      renewable_energy_pct,
      waste_recycling_pct,
      carbon_footprint_tons,
      water_usage_m3,
      women_in_mgmt_pct,
      lost_time_injury_rate,
      living_wage_compliant,
      child_labor_policy,
      anti_corruption_policy,
      independent_audit,
      gdpr_compliant,
      data_breach_incidents
    `)
    .eq("status", "approved");

  if (error) throw error;
  return data ?? [];
}

export async function fetchEsgPortfolioSummaryFromRPC() {
  const { data, error } = await supabase.rpc("get_esg_portfolio_summary");
  if (error) throw error;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  return parsed as Record<string, number | null>;
}

/** Latest assessment row for a supplier (any status), most recent by assessment_date. */
export async function fetchLatestAssessmentBySupplier(supplierId: string) {
  const { data, error } = await supabase
    .from("srm_esg_assessments")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}

export async function fetchAssessmentHistoryBySupplier(supplierId: string) {
  return supabase
    .from("srm_esg_assessments")
    .select(`
      id, period, assessment_date, status,
      overall_esg_score, env_score, social_score, gov_score
    `)
    .eq("supplier_id", supplierId)
    .eq("status", "approved")
    .order("assessment_date", { ascending: true });
}

export async function insertEsgAssessmentRecord(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("srm_esg_assessments")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Raw leaderboard candidates (ordered by score); caller dedupes per supplier. */
export async function fetchLeaderboardAssessmentRows() {
  const { data, error } = await supabase
    .from("srm_esg_assessments")
    .select(`
      supplier_id,
      overall_esg_score,
      env_score,
      social_score,
      gov_score,
      env_certifications,
      social_certifications,
      gov_certifications,
      assessment_date,
      srm_suppliers!inner(name, industry)
    `)
    .eq("status", "approved")
    .order("overall_esg_score", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
