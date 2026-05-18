import { supabase } from "../../db/supabaseClient";
import type { SpendSummaryFilters } from "./spend.schema";

export interface SpendRecordFilters extends SpendSummaryFilters {
  categoryIds?: string[];
  regionIds?: string[];
  supplierIds?: string[];
  businessGroupIds?: string[];
}

export interface SpendDimensionRow {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SpendBusinessGroupRow {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface SpendRecordRow {
  id: string;
  supplier_id: string;
  category_id: string;
  region_id: string;
  business_group_id: string;
  amount: number;
  currency: string;
  spend_date: string;
  supplier_name: string | null;
}

export interface SpendSupplierContextRow {
  supplier_id: string;
  current_risk_level: string | null;
  latest_performance_score: number | null;
  esg_score: number | null;
  active_contract_count: number;
  active_contract_value: number;
}

function normalizeSupplierName(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? null;
  }
  if (value && typeof value === "object" && "name" in value) {
    return (value as { name?: string | null }).name ?? null;
  }
  return null;
}

export async function listSpendCategories(): Promise<SpendDimensionRow[]> {
  const { data, error } = await supabase
    .from("spend_categories")
    .select("id, name, level, parent_id, sort_order, is_active")
    .eq("is_active", true)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SpendDimensionRow[];
}

export async function listSpendRegions(): Promise<SpendDimensionRow[]> {
  const { data, error } = await supabase
    .from("spend_regions")
    .select("id, name, level, parent_id, sort_order, is_active")
    .eq("is_active", true)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SpendDimensionRow[];
}

export async function listSpendBusinessGroups(): Promise<SpendBusinessGroupRow[]> {
  const { data, error } = await supabase
    .from("spend_business_groups")
    .select("id, name, code, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SpendBusinessGroupRow[];
}

export async function listSpendRecords(filters: SpendRecordFilters): Promise<SpendRecordRow[]> {
  let query = supabase
    .from("spend_records")
    .select("id, supplier_id, category_id, region_id, business_group_id, amount, currency, spend_date, srm_suppliers(name)")
    .order("spend_date", { ascending: false });

  if (filters.categoryIds?.length) query = query.in("category_id", filters.categoryIds);
  else if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.regionIds?.length) query = query.in("region_id", filters.regionIds);
  else if (filters.regionId) query = query.eq("region_id", filters.regionId);
  if (filters.supplierIds?.length) query = query.in("supplier_id", filters.supplierIds);
  else if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.businessGroupIds?.length) query = query.in("business_group_id", filters.businessGroupIds);
  else if (filters.businessGroupId) query = query.eq("business_group_id", filters.businessGroupId);
  if (filters.dateFrom) query = query.gte("spend_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("spend_date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      supplier_id: String(record.supplier_id),
      category_id: String(record.category_id),
      region_id: String(record.region_id),
      business_group_id: String(record.business_group_id),
      amount: Number(record.amount ?? 0),
      currency: String(record.currency ?? "USD"),
      spend_date: String(record.spend_date),
      supplier_name: normalizeSupplierName(record.srm_suppliers),
    };
  });
}

export async function listSpendSupplierContext(supplierIds: string[]): Promise<SpendSupplierContextRow[]> {
  const ids = Array.from(new Set(supplierIds)).filter(Boolean);
  if (ids.length === 0) return [];

  const [summaryResult, contractResult, esgResult] = await Promise.all([
    supabase
      .from("v_supplier_summary")
      .select("id, current_risk_level, latest_performance_score")
      .in("id", ids),
    supabase
      .from("contracts")
      .select("supplier_id, status, contract_size")
      .in("supplier_id", ids),
    supabase
      .from("srm_esg_assessments")
      .select("supplier_id, overall_esg_score, assessment_date")
      .eq("status", "approved")
      .in("supplier_id", ids)
      .order("assessment_date", { ascending: false }),
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (contractResult.error) throw contractResult.error;
  if (esgResult.error) throw esgResult.error;

  const context = new Map<string, SpendSupplierContextRow>();
  for (const id of ids) {
    context.set(id, {
      supplier_id: id,
      current_risk_level: null,
      latest_performance_score: null,
      esg_score: null,
      active_contract_count: 0,
      active_contract_value: 0,
    });
  }

  for (const row of summaryResult.data ?? []) {
    const item = context.get(String(row.id));
    if (!item) continue;
    item.current_risk_level = row.current_risk_level == null ? null : String(row.current_risk_level);
    item.latest_performance_score =
      row.latest_performance_score == null ? null : Number(row.latest_performance_score);
  }

  for (const row of contractResult.data ?? []) {
    const supplierId = row.supplier_id == null ? null : String(row.supplier_id);
    if (!supplierId) continue;
    const item = context.get(supplierId);
    if (!item) continue;
    if (String(row.status ?? "").toLowerCase() !== "active") continue;
    item.active_contract_count += 1;
    item.active_contract_value += Number(row.contract_size ?? 0);
  }

  const seenEsg = new Set<string>();
  for (const row of esgResult.data ?? []) {
    const supplierId = row.supplier_id == null ? null : String(row.supplier_id);
    if (!supplierId || seenEsg.has(supplierId)) continue;
    const item = context.get(supplierId);
    if (!item) continue;
    item.esg_score = row.overall_esg_score == null ? null : Number(row.overall_esg_score);
    seenEsg.add(supplierId);
  }

  return Array.from(context.values()).map((item) => ({
    ...item,
    active_contract_value: Math.round(item.active_contract_value * 100) / 100,
  }));
}
