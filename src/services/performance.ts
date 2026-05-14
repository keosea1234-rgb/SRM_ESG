import { apiGet } from "../lib/api";

export interface PerformanceSummaryRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  evaluation_period: string;
  quality_score: number;
  delivery_score: number;
  price_score: number;
  communication_score: number;
  overall_score: number;
  srm_suppliers?: {
    name?: string | null;
    industry?: string | null;
  };
}

export interface PerformanceSummaryResponse {
  data: PerformanceSummaryRow[];
  pagination: unknown;
}

export async function fetchPerformanceSummary(
  params?: Record<string, unknown>
): Promise<PerformanceSummaryResponse> {
  void params;
  return apiGet<PerformanceSummaryResponse>("/api/performance/summary");
}

export async function fetchPerformanceSuppliers(): Promise<{
  data: { id: string; name: string }[];
  pagination?: unknown;
}> {
  return apiGet<{ data: { id: string; name: string }[]; pagination?: unknown }>(
    "/api/suppliers?limit=200&status=active"
  );
}
