import { supabase } from "../../db/supabaseClient";
import logger from "../../shared/logger";
import type { ActivityLogRow } from "../../db/database.types";
import {
  toRange,
  buildPaginatedResult,
  type PaginationParams,
} from "../../shared/pagination";

export type { ActivityLogRow };

export type ActivityLogFilters = {
  supplierId?: string;
  action?: string;
  page?: number;
  limit?: number;
};

export type ActivityLogResult = {
  data: ActivityLogRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export async function findActivityLog(filters: ActivityLogFilters): Promise<ActivityLogResult> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const { from, to } = toRange({ page, limit });

  let query = supabase
    .from("srm_activity_log")
    .select("*", { count: "exact" })
    .order("performed_at", { ascending: false })
    .range(from, to);

  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.action) query = query.eq("action", filters.action);

  const { data, error, count } = await query;
  if (error) {
    logger.error({ err: error }, "findActivityLog Supabase error");
    throw error;
  }

  return {
    data: data ?? [],
    pagination: {
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  };
}

export async function findDistinctActions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("srm_activity_log")
    .select("action");
  if (error) throw error;
  const unique = [...new Set((data ?? []).map((r) => r.action).filter(Boolean))];
  return unique as string[];
}

export async function createActivityLog(payload: Partial<ActivityLogRow>) {
  return supabase.from("srm_activity_log").insert(payload).select().single();
}
