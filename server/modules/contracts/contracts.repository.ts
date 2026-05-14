// server/modules/contracts/contracts.repository.ts
// All direct Supabase queries for contracts
// Pagination via shared utility

import { supabase } from "../../db/supabaseClient";
import type { ContractRow } from "../../db/database.types";
import {
  toRange,
  buildPaginatedResult,
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";
import type { ContractFilters } from '../../shared/filters';

export type ContractSummary = ContractRow;

// ─── List (paginated) ────────────────────────────────────────────────────────

export async function listContracts(
  params: PaginationParams,
  filters: ContractFilters = {}
): Promise<PaginatedResult<ContractRow>> {
  const { from, to } = toRange(params);

  let query = supabase
    .from('contracts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

// ─── Single ──────────────────────────────────────────────────────────────────

export async function getContractById(id: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createContract(
  payload: Partial<ContractRow>
): Promise<ContractRow> {
  const { data, error } = await supabase
    .from("contracts")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateContract(
  id: string,
  payload: Partial<ContractRow>
): Promise<ContractRow> {
  const { data, error } = await supabase
    .from("contracts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
}
