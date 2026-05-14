import { apiGet, apiPost } from "../lib/api";

export interface ReportingCoverage {
  frameworks: Array<{ id: string; code: string; name: string; status: string }>;
  total_requirements: number;
  mapped_requirements: number;
  response_status_counts: Record<string, number>;
  evidence_count: number;
  missing_evidence_count: number;
  requirements: Array<{
    id: string;
    requirement_code: string;
    title: string;
    pillar: string;
  }>;
}

export interface MaterialitySummary {
  assessments: Array<{
    id: string;
    title: string;
    reporting_period: string;
    status: string;
    threshold: number;
  }>;
  topics: Array<{
    id: string;
    title: string;
    category: string;
    impact_score: number;
    financial_score: number;
    is_material: boolean;
  }>;
  material_topics_count: number;
}

export interface CarbonSummary {
  total_tco2e: number;
  scope3_tco2e: number;
  scope3_by_category: Record<string, number>;
  data_quality_counts: Record<string, number>;
  sbti_targets: Array<Record<string, unknown>>;
  product_footprints: Array<Record<string, unknown>>;
}

export interface RiskIndicatorSummary {
  total_indicators: number;
  active_indicators: number;
  category_counts: Record<string, number>;
  supplier_score_count: number;
  average_score: number | null;
  tier_relationship_count: number;
  country_score_count: number;
  sector_score_count: number;
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    weight: number;
    source_type: string;
  }>;
}

export interface ProductComplianceSummary {
  product_count: number;
  requirement_count: number;
  assessment_status_counts: Record<string, number>;
  critical_requirement_count: number;
  requirements: Array<{
    id: string;
    regulation_code: string;
    requirement_code: string;
    title: string;
    criticality: string;
  }>;
}

export interface MonitoringSummary {
  sources: Array<{
    id: string;
    code: string;
    name: string;
    source_type: string;
    is_active: boolean;
  }>;
  hits: Array<{
    id: string;
    title: string;
    severity: string | null;
    review_status: string;
    source_url: string;
    confidence: number;
  }>;
  incidents: Array<Record<string, unknown>>;
  review_status_counts: Record<string, number>;
  severity_counts: Record<string, number>;
}

export function fetchReportingCoverage() {
  return apiGet<ReportingCoverage>("/api/compliance/reporting/coverage");
}

export function fetchMaterialitySummary() {
  return apiGet<MaterialitySummary>("/api/compliance/materiality");
}

export function createMaterialityAssessment(body: unknown) {
  return apiPost("/api/compliance/materiality", body);
}

export function fetchCarbonSummary() {
  return apiGet<CarbonSummary>("/api/compliance/carbon/summary");
}

export function createCarbonRecord(body: unknown) {
  return apiPost("/api/compliance/carbon/records", body);
}

export function fetchRiskIndicatorSummary() {
  return apiGet<RiskIndicatorSummary>("/api/compliance/risk-indicators/summary");
}

export function fetchProductComplianceSummary() {
  return apiGet<ProductComplianceSummary>("/api/compliance/product-compliance/summary");
}

export function createProductComplianceAssessment(body: unknown) {
  return apiPost("/api/compliance/product-compliance/assessments", body);
}

export function fetchMonitoringSummary() {
  return apiGet<MonitoringSummary>("/api/compliance/monitoring");
}

export function createMonitoringHit(body: unknown) {
  return apiPost("/api/compliance/monitoring/hits", body);
}
