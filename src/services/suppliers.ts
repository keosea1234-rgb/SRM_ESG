import { apiGet, apiGetRaw } from "../lib/api";
import type { ComparisonResponse, ComparisonSupplier, SupplierSummary } from "../types";

export interface SupplierListResponse {
  data: SupplierSummary[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

type PaginatedSuppliersBody = {
  data: SupplierSummary[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export async function fetchSuppliersPool(): Promise<SupplierSummary[]> {
  const res = await apiGet<PaginatedSuppliersBody | SupplierSummary[]>("/api/suppliers?page=1&limit=100");
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export async function fetchComparison(ids: string[]): Promise<ComparisonSupplier[]> {
  const data = await apiGet<ComparisonResponse>(`/api/suppliers/compare?ids=${ids.join(",")}`);
  return data.suppliers ?? [];
}

function unwrapSupplierListPayload(json: unknown): PaginatedSuppliersBody {
  if (
    typeof json === "object" &&
    json !== null &&
    "ok" in json &&
    (json as { ok: unknown }).ok === true &&
    "data" in json
  ) {
    const inner = (json as { data: unknown }).data;
    if (
      typeof inner === "object" &&
      inner !== null &&
      "data" in inner &&
      "pagination" in inner
    ) {
      return inner as PaginatedSuppliersBody;
    }
  }
  return json as PaginatedSuppliersBody;
}

export async function fetchSupplierList(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<SupplierListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.pageSize ?? 20));

  const json = await apiGetRaw<unknown>(`/api/suppliers?${qs.toString()}`);
  const body = unwrapSupplierListPayload(json);

  const { total, page, limit, totalPages } = body.pagination;
  return {
    data: body.data,
    pagination: { total, page, pageSize: limit, totalPages },
  };
}

export interface SupplierESGSummary {
  overall_esg_score: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
  status: string;
  assessed_at: string;
}

export async function fetchSupplierESG(supplierId: string): Promise<SupplierESGSummary | null> {
  try {
    return await apiGet<SupplierESGSummary>(`/api/esg/${supplierId}`);
  } catch {
    return null;
  }
}

export interface SupplierNarrativeSignal {
  type:
    | "esg_decline"
    | "risk_increase"
    | "performance_drop"
    | "cert_expiring"
    | "esg_hotspot"
    | "positive_trend";
  severity: "high" | "medium" | "low";
  message: string;
  delta?: number;
  metric?: string;
}

export interface SupplierHealthNarrative {
  supplierId: string;
  generatedAt: string;
  overallSummary: string;
  signals: SupplierNarrativeSignal[];
  trendDirection: "improving" | "declining" | "stable";
}

export async function fetchHealthNarrative(supplierId: string): Promise<SupplierHealthNarrative | null> {
  try {
    return await apiGet<SupplierHealthNarrative>(`/api/suppliers/${supplierId}/health-narrative`);
  } catch {
    return null;
  }
}

export type SupplierSegment =
  | "strategic"
  | "at_risk"
  | "esg_laggard"
  | "high_performer"
  | "single_source"
  | "watch"
  | "standard";

export interface SupplierSegmentsResponse {
  availableSegments: { key: SupplierSegment; label: string }[];
  bySegment: Record<SupplierSegment, string[]>;
  bySupplier: Record<string, SupplierSegment[]>;
  counts: Record<SupplierSegment, number>;
}

export async function fetchSupplierSegments(): Promise<SupplierSegmentsResponse> {
  return apiGet<SupplierSegmentsResponse>("/api/suppliers/segments");
}
