// server/modules/performance/performance.repository.ts
// All direct Supabase queries for performance evaluations

import { supabase } from "../../db/supabaseClient";
import type { PerformanceEvaluationRow } from "../../db/database.types";
import {
  toRange,
  buildPaginatedResult,
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";

// ─── List (paginated) ────────────────────────────────────────────────────────

export async function listPerformanceEvaluations(
  params: PaginationParams
): Promise<PaginatedResult<PerformanceEvaluationRow>> {
  const { from, to } = toRange(params);

  const { data, error, count } = await supabase
    .from("srm_performance_evaluations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ─── List by supplier (paginated) ────────────────────────────────────────────

export async function listPerformanceBySupplier(
  supplierId: string,
  params: PaginationParams
): Promise<PaginatedResult<PerformanceEvaluationRow>> {
  const { from, to } = toRange(params);

  const { data, error, count } = await supabase
    .from("srm_performance_evaluations")
    .select("*", { count: "exact" })
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ─── Single ──────────────────────────────────────────────────────────────────

export async function getPerformanceById(
  id: string
): Promise<PerformanceEvaluationRow | null> {
  const { data, error } = await supabase
    .from("srm_performance_evaluations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createPerformanceEvaluation(
  payload: Partial<PerformanceEvaluationRow>
): Promise<PerformanceEvaluationRow> {
  const { data, error } = await supabase
    .from("srm_performance_evaluations")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updatePerformanceEvaluation(
  id: string,
  payload: Partial<PerformanceEvaluationRow>
): Promise<PerformanceEvaluationRow> {
  const { data, error } = await supabase
    .from("srm_performance_evaluations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvaluation(id: string) {
  return supabase
    .from("srm_performance_evaluations")
    .delete()
    .eq("id", id);
}

export async function findEvaluationsBySupplier(supplierId: string) {
  return listPerformanceBySupplier(supplierId, { page: 1, limit: 100 });
}
export const findEvaluationById = getPerformanceById;
export const insertEvaluation = createPerformanceEvaluation;
export const updateEvaluation = updatePerformanceEvaluation;

export async function findLatestEvaluationsAllSuppliers() {
  return supabase
    .from("srm_performance_evaluations")
    .select("*, srm_suppliers(name, industry)")
    .order("created_at", { ascending: false });
}

export type { PerformanceEvaluationRow };
export type CreatePerformanceEvaluationInput = Partial<PerformanceEvaluationRow>;
