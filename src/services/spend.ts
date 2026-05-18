import { apiGet } from "../lib/api";

export interface SpendFilterOption {
  value: string;
  label: string;
  name: string;
  path?: string;
  level?: number;
  parentId?: string | null;
  totalSpend?: number;
  recordCount?: number;
}

export interface SpendSummaryNode {
  id: string;
  name: string;
  path: string;
  level: number;
  parentId: string | null;
  totalSpend: number;
  recordCount: number;
}

export interface SpendKpis {
  totalSpend: number;
  managedSpend: number;
  managedSpendPct: number;
  unmanagedSpend: number;
  contractCoveragePct: number;
  highRiskSpend: number;
  criticalSupplierSpend: number;
  esgLowSpend: number;
  topSupplierConcentrationPct: number;
  riskAdjustedSpend: number;
}

export interface SpendSupplierBreakdown {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  recordCount: number;
  primaryCategoryPath: string | null;
  businessGroupCount: number;
  currentRiskLevel: string | null;
  latestPerformanceScore: number | null;
  esgScore: number | null;
  activeContractCount: number;
  activeContractValue: number;
  isManaged: boolean;
  contractCoverageStatus: "covered" | "partial" | "uncovered";
  contractCoverageGap: number;
  riskAdjustedSpend: number;
  healthScore: number | null;
  healthBand: "strong" | "watch" | "at_risk" | "unknown";
  contextCompleteness: number;
}

export interface SpendBusinessGroupBreakdown {
  id: string;
  name: string;
  totalSpend: number;
  recordCount: number;
}

export interface SpendTrendPoint {
  period: string;
  totalSpend: number;
  recordCount: number;
}

export interface SpendDetailRow {
  id: string;
  supplierId: string;
  supplierName: string;
  categoryPath: string | null;
  regionPath: string | null;
  businessGroupName: string | null;
  amount: number;
  currency: string;
  spendDate: string;
  currentRiskLevel: string | null;
  latestPerformanceScore: number | null;
  esgScore: number | null;
  isManaged: boolean;
}

export interface SpendContractCoverage {
  managedSpend: number;
  unmanagedSpend: number;
  coverageGapSpend: number;
  managedSupplierCount: number;
  partiallyCoveredSupplierCount: number;
  unmanagedSupplierCount: number;
  suppliersWithoutActiveContract: SpendSupplierBreakdown[];
  suppliersWithCoverageGap: SpendSupplierBreakdown[];
}

export interface SpendSupplierHealthSummary {
  strongSupplierCount: number;
  watchSupplierCount: number;
  atRiskSupplierCount: number;
  unknownSupplierCount: number;
  avgHealthScore: number | null;
}

export interface SpendOpportunity {
  id: string;
  type: "contract_leakage" | "supplier_consolidation" | "tail_spend" | "high_risk_spend" | "category_concentration";
  title: string;
  impact: number;
  confidence: "high" | "medium" | "low";
  affectedSupplierCount: number;
  affectedRecordCount: number;
  reason: string;
  recommendedAction: string;
}

export interface SpendAnalystGroup {
  id: string;
  groupBy: "category" | "supplier" | "region" | "businessGroup";
  label: string;
  totalSpend: number;
  recordCount: number;
  supplierCount: number;
  managedSpend: number;
  unmanagedSpend: number;
  highRiskSpend: number;
  coverageGapSpend: number;
  riskSupplierCount: number;
  opportunityImpact: number;
  quickFilters: Array<"high_risk" | "unmanaged" | "tail_spend" | "top_supplier" | "coverage_gap">;
}

export interface SpendExportRow {
  spendId: string;
  spendDate: string;
  supplierId: string;
  supplierName: string;
  categoryPath: string | null;
  regionPath: string | null;
  businessGroupName: string | null;
  amount: number;
  currency: string;
  managedStatus: "managed" | "unmanaged";
  riskLevel: string | null;
  performanceScore: number | null;
  esgScore: number | null;
}

export interface SpendSummaryResponse {
  totals: {
    totalSpend: number;
    recordsCount: number;
    supplierCount: number;
    categoryCount: number;
    regionCount: number;
    businessGroupCount: number;
    currencies: string[];
  };
  kpis: SpendKpis;
  filters: {
    categories: SpendFilterOption[];
    regions: SpendFilterOption[];
    suppliers: SpendFilterOption[];
    businessGroups: SpendFilterOption[];
  };
  categoryBreakdown: SpendSummaryNode[];
  regionBreakdown: SpendSummaryNode[];
  supplierBreakdown: SpendSupplierBreakdown[];
  businessGroupBreakdown: SpendBusinessGroupBreakdown[];
  trend: SpendTrendPoint[];
  spendRows: SpendDetailRow[];
  supplierRiskOverlay: SpendSupplierBreakdown[];
  contractCoverage: SpendContractCoverage;
  supplierHealthSummary: SpendSupplierHealthSummary;
  opportunities: SpendOpportunity[];
  analystWorkspace: SpendAnalystGroup[];
  exportRows: SpendExportRow[];
  dataQualityWarnings: string[];
}

export interface SpendSummaryParams {
  categoryIds?: string[];
  regionIds?: string[];
  supplierIds?: string[];
  businessGroupIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

function setArrayParam(searchParams: URLSearchParams, key: string, values?: string[]) {
  const selected = (values ?? []).filter((value) => value !== "all");
  if (selected.length > 0) searchParams.set(key, selected.join(","));
}

export async function fetchSpendSummary(params: SpendSummaryParams): Promise<SpendSummaryResponse> {
  const searchParams = new URLSearchParams();

  setArrayParam(searchParams, "categoryIds", params.categoryIds);
  setArrayParam(searchParams, "regionIds", params.regionIds);
  setArrayParam(searchParams, "supplierIds", params.supplierIds);
  setArrayParam(searchParams, "businessGroupIds", params.businessGroupIds);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);

  const qs = searchParams.toString();
  return apiGet<SpendSummaryResponse>(`/api/spend/summary${qs ? `?${qs}` : ""}`);
}
