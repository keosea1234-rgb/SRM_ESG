// server/modules/suppliers/suppliers.repository.ts
// All direct Supabase queries for suppliers.
// - getAllSuppliers: legacy, no pagination (kept for backward compat)
// - listSuppliers: paginated version used by the list endpoint

import { supabase } from "../../db/supabaseClient";
import type {
  SupplierRow,
  SupplierContactRow,
  ContractRow,
  SupplierSummaryRow,
} from "../../db/database.types";
import {
  toRange,
  buildPaginatedResult,
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";
import type { SupplierFilters } from '../../shared/filters';

// Re-export types used by service + controller layers
export type Supplier = SupplierRow;
export type SupplierContact = SupplierContactRow;
export type SupplierContract = ContractRow;
export type SupplierSummary = SupplierSummaryRow;

// ── LIST (paginated) ──────────────────────────────────────────────────────────

export async function listSuppliers(
  params: PaginationParams,
  filters: SupplierFilters = {}
): Promise<PaginatedResult<SupplierSummaryRow>> {
  const { from, to } = toRange(params);

  let query = supabase
    .from('v_supplier_summary')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ── LIST (legacy, no pagination) ─────────────────────────────────────────────
// Kept for backward compatibility — existing tests mock this function.

export async function getAllSuppliers() {
  return supabase
    .from("v_supplier_summary")
    .select("*")
    .order("name", { ascending: true });
}

// ── SINGLE ────────────────────────────────────────────────────────────────────

export async function getSupplierById(id: string) {
  return supabase
    .from("srm_suppliers")
    .select("*")
    .eq("id", id)
    .single();
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createSupplier(payload: Record<string, unknown>) {
  return supabase
    .from("srm_suppliers")
    .insert(payload)
    .select()
    .single();
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateSupplier(id: string, payload: Record<string, unknown>) {
  return supabase
    .from("srm_suppliers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
}

// ── CONTACTS ─────────────────────────────────────────────────────────────────

export async function getSupplierContacts(supplierId: string) {
  return supabase
    .from("srm_supplier_contacts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
}

export async function createSupplierContact(
  supplierId: string,
  payload: Record<string, unknown>
) {
  return supabase
    .from("srm_supplier_contacts")
    .insert({ ...payload, supplier_id: supplierId })
    .select()
    .single();
}

// ── CONTRACTS ─────────────────────────────────────────────────────────────────

export async function getSupplierContracts(supplierId: string) {
  return supabase
    .from("contracts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
}

// ── INVITE ────────────────────────────────────────────────────────────────────

export async function getSupplierForInvite(supplierId: string) {
  return supabase
    .from("srm_suppliers")
    .select("id, name, invite_status")
    .eq("id", supplierId)
    .single();
}

export async function inviteSupplierByEmail(params: {
  email: string;
  supplierId: string;
  supplierName: string | null;
}) {
  return supabase.auth.admin.inviteUserByEmail(params.email, {
    data: {
      role: "supplier",
      supplier_id: params.supplierId,
      supplier_name: params.supplierName,
    },
  });
}

export async function markSupplierInvited(supplierId: string, email: string) {
  return supabase
    .from("srm_suppliers")
    .update({ invite_status: "invited", invited_email: email })
    .eq("id", supplierId)
    .select()
    .single();
}

// ── ACTIVITY LOG ─────────────────────────────────────────────────────────────

export async function insertSupplierActivityLog(payload: Record<string, unknown>) {
  return supabase.from("srm_activity_log").insert(payload);
}