import { apiGet } from "../lib/api";

export interface ActivityLogRow {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  entity_type: string | null;
  action: string | null;
  description: string | null;
  performed_at: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface ActivityLogResponse {
  data: ActivityLogRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export async function fetchActivityLog(params: {
  page: number;
  limit: number;
  action?: string;
  supplierId?: string;
}): Promise<ActivityLogResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.action) qs.set("action", params.action);
  if (params.supplierId) qs.set("supplierId", params.supplierId);
  return apiGet<ActivityLogResponse>(`/api/activity-log?${qs}`);
}

export async function fetchActivityActions(): Promise<string[]> {
  const actionsResult = await apiGet<{ data: string[] } | string[]>("/api/activity-log/actions");
  return Array.isArray(actionsResult) ? actionsResult : actionsResult.data ?? [];
}
