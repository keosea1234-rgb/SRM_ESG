import { apiGet } from "../lib/api";

export interface RiskSummaryRow {
  id: string;
  supplier_id: string;
  supplier_code: string;
  assessment_date: string;
  overall_risk_level: string;
  financial_risk: number;
  operational_risk: number;
  compliance_risk: number;
  geopolitical_risk: number;
  reputational_risk: number;
  notes: string | null;
  srm_suppliers?: { name?: string | null; industry?: string | null };
}

export interface RiskSummaryResponse {
  data: RiskSummaryRow[];
  pagination: unknown;
}

export async function fetchRiskSummary(): Promise<RiskSummaryResponse> {
  return apiGet<RiskSummaryResponse>("/api/risk/summary");
}

export async function fetchRiskSuppliers(): Promise<{ data: { id: string; name: string; country?: string | null }[] }> {
  return apiGet<{ data: { id: string; name: string; country?: string | null }[] }>("/api/suppliers?limit=200&status=active");
}
