// server/modules/risk/risk.repository.ts
// All direct Supabase queries for risk assessments

import { supabase } from "../../db/supabaseClient";
import type { RiskAssessmentRow } from "../../db/database.types";
import {
  toRange,
  buildPaginatedResult,
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";

// ─── List (paginated) ────────────────────────────────────────────────────────

export async function listRiskAssessments(
  params: PaginationParams
): Promise<PaginatedResult<RiskAssessmentRow>> {
  const { from, to } = toRange(params);

  const { data, error, count } = await supabase
    .from("srm_risk_assessments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ─── List by supplier (paginated) ────────────────────────────────────────────

export async function listRiskBySupplier(
  supplierId: string,
  params: PaginationParams
): Promise<PaginatedResult<RiskAssessmentRow>> {
  const { from, to } = toRange(params);

  const { data, error, count } = await supabase
    .from("srm_risk_assessments")
    .select("*", { count: "exact" })
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ─── Single ──────────────────────────────────────────────────────────────────

export async function getRiskById(id: string): Promise<RiskAssessmentRow | null> {
  const { data, error } = await supabase
    .from("srm_risk_assessments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createRiskAssessment(
  payload: Partial<RiskAssessmentRow>
): Promise<RiskAssessmentRow> {
  const { data, error } = await supabase
    .from("srm_risk_assessments")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateRiskAssessment(
  id: string,
  payload: Partial<RiskAssessmentRow>
): Promise<RiskAssessmentRow> {
  const { data, error } = await supabase
    .from("srm_risk_assessments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export const findAssessmentsBySupplier = listRiskBySupplier;
export const findAssessmentById = getRiskById;
export const insertAssessment = createRiskAssessment;
export const updateAssessment = updateRiskAssessment;

export async function deleteAssessment(id: string) {
  return supabase
    .from("srm_risk_assessments")
    .delete()
    .eq("id", id);
}

export async function findLatestAssessmentsAllSuppliers() {
  return supabase
    .from("srm_risk_assessments")
    .select("*, srm_suppliers(name, industry)")
    .order("assessment_date", { ascending: false });
}

export async function getRiskHeatmapData(): Promise<
  { industry: string; risk_type: string; avg_score: number }[]
> {
  const { data, error } = await supabase
    .from("srm_risk_assessments")
    .select(`
      financial_risk,
      operational_risk,
      compliance_risk,
      geopolitical_risk,
      reputational_risk,
      srm_suppliers!inner(industry)
    `);

  if (error) throw error;

  const buckets: Record<string, { sum: number; count: number }> = {};

  const riskFields = [
    { key: "financial_risk", label: "Financial" },
    { key: "operational_risk", label: "Operational" },
    { key: "compliance_risk", label: "Compliance" },
    { key: "geopolitical_risk", label: "Geopolitical" },
    { key: "reputational_risk", label: "Reputational" },
  ] as const;

  for (const row of data ?? []) {
    const raw = row as Record<string, unknown> & {
      srm_suppliers?: { industry: string | null } | { industry: string | null }[] | null;
    };
    const sup = raw.srm_suppliers;
    const joined = Array.isArray(sup) ? sup[0] : sup;
    const industry = joined?.industry;
    if (!industry) continue;

    for (const { key, label } of riskFields) {
      const score = raw[key] as number | null | undefined;
      if (score == null) continue;
      const bucketKey = `${industry}||${label}`;
      if (!buckets[bucketKey]) buckets[bucketKey] = { sum: 0, count: 0 };
      buckets[bucketKey].sum += Number(score);
      buckets[bucketKey].count += 1;
    }
  }

  return Object.entries(buckets).map(([k, v]) => {
    const [industry, risk_type] = k.split("||");
    return { industry, risk_type, avg_score: Math.round((v.sum / v.count) * 10) / 10 };
  });
}

export type { RiskAssessmentRow };
export type CreateRiskAssessmentInput = Partial<RiskAssessmentRow>;
