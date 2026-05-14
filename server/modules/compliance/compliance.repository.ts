import { supabase } from "../../db/supabaseClient";

export type FrameworkRow = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type ReportingRequirementRow = {
  id: string;
  framework_id: string;
  requirement_code: string;
  title: string;
  pillar: string;
  response_status: string;
  is_mapped: boolean;
};

export type EvidenceRow = {
  id: string;
  requirement_id: string;
};

export type MaterialityAssessmentRow = {
  id: string;
  title: string;
  reporting_period: string;
  status: string;
  threshold: number;
};

export type MaterialityTopicRow = {
  id: string;
  assessment_id: string | null;
  title: string;
  category: string;
  impact_score: number;
  financial_score: number;
  is_material: boolean;
};

export type CarbonRecordRow = {
  id: string;
  scope: string;
  category: string | null;
  tco2e: number;
  data_quality: string;
};

export type RiskIndicatorRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  weight: number;
  source_type: string;
  is_active: boolean;
};

export type RiskScoreRow = {
  id: string;
  indicator_id: string | null;
  kind: string;
  score: number | null;
};

export type ProductRow = { id: string; label: string };
export type ProductRequirementRow = {
  id: string;
  regulation_code: string;
  requirement_code: string;
  title: string;
  criticality: string;
};
export type ProductAssessmentRow = {
  id: string;
  product_id: string;
  requirement_id: string;
  status: string;
};

export type MonitoringSourceRow = {
  id: string;
  code: string;
  name: string;
  source_type: string;
  is_active: boolean;
};

export type MonitoringHitRow = {
  id: string;
  source_id: string | null;
  title: string;
  severity: string | null;
  review_status: string;
  source_url: string;
  confidence: number;
};

export type MonitoringIncidentRow = {
  id: string;
  payload: Record<string, unknown>;
};

export async function listFrameworks(): Promise<FrameworkRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_frameworks")
    .select("id, code, name, status")
    .order("code");
  if (error) throw error;
  return (data ?? []) as FrameworkRow[];
}

export async function listReportingRequirements(): Promise<ReportingRequirementRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_reporting_requirements")
    .select("id, framework_id, requirement_code, title, pillar, response_status, is_mapped")
    .order("requirement_code");
  if (error) throw error;
  return (data ?? []) as ReportingRequirementRow[];
}

export async function listReportingEvidence(): Promise<EvidenceRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_reporting_evidence")
    .select("id, requirement_id");
  if (error) throw error;
  return (data ?? []) as EvidenceRow[];
}

export async function listMaterialityAssessments(): Promise<MaterialityAssessmentRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_materiality_assessments")
    .select("id, title, reporting_period, status, threshold")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaterialityAssessmentRow[];
}

export async function listMaterialityTopics(): Promise<MaterialityTopicRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_materiality_topics")
    .select("id, assessment_id, title, category, impact_score, financial_score, is_material");
  if (error) throw error;
  return (data ?? []) as MaterialityTopicRow[];
}

export async function insertMaterialityAssessment(row: {
  title: string;
  reporting_period: string;
  status: string;
  threshold: number;
}): Promise<MaterialityAssessmentRow> {
  const { data, error } = await supabase
    .from("srm_compliance_materiality_assessments")
    .insert({
      title: row.title,
      reporting_period: row.reporting_period,
      status: row.status,
      threshold: row.threshold,
    })
    .select("id, title, reporting_period, status, threshold")
    .single();
  if (error) throw error;
  return data as MaterialityAssessmentRow;
}

export async function insertMaterialityTopics(
  topics: Array<{
    assessment_id: string;
    title: string;
    category: string;
    impact_score: number;
    financial_score: number;
    is_material: boolean;
  }>
): Promise<void> {
  if (topics.length === 0) return;
  const { error } = await supabase.from("srm_compliance_materiality_topics").insert(topics);
  if (error) throw error;
}

export async function listCarbonRecords(): Promise<CarbonRecordRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_carbon_records")
    .select("id, scope, category, tco2e, data_quality");
  if (error) throw error;
  return (data ?? []) as CarbonRecordRow[];
}

export async function insertCarbonRecord(row: {
  scope: string;
  category: string | null;
  tco2e: number;
  data_quality: string;
}): Promise<CarbonRecordRow> {
  const { data, error } = await supabase
    .from("srm_compliance_carbon_records")
    .insert(row)
    .select("id, scope, category, tco2e, data_quality")
    .single();
  if (error) throw error;
  return data as CarbonRecordRow;
}

export async function listSbtiTargets(): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  const { data, error } = await supabase.from("srm_compliance_carbon_sbti_targets").select("id, payload");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown> }>;
}

export async function listProductFootprints(): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  const { data, error } = await supabase.from("srm_compliance_carbon_product_footprints").select("id, payload");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown> }>;
}

export async function listRiskIndicators(): Promise<RiskIndicatorRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_risk_indicators")
    .select("id, code, name, category, weight, source_type, is_active")
    .order("code");
  if (error) throw error;
  return (data ?? []) as RiskIndicatorRow[];
}

export async function listRiskScoreRows(): Promise<RiskScoreRow[]> {
  const { data, error } = await supabase.from("srm_compliance_risk_score_rows").select("id, indicator_id, kind, score");
  if (error) throw error;
  return (data ?? []) as RiskScoreRow[];
}

export async function listProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase.from("srm_compliance_products").select("id, label");
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function listProductRequirements(): Promise<ProductRequirementRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_product_requirements")
    .select("id, regulation_code, requirement_code, title, criticality");
  if (error) throw error;
  return (data ?? []) as ProductRequirementRow[];
}

export async function listProductAssessments(): Promise<ProductAssessmentRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_product_assessments")
    .select("id, product_id, requirement_id, status");
  if (error) throw error;
  return (data ?? []) as ProductAssessmentRow[];
}

export async function insertProductAssessment(row: {
  product_id: string;
  requirement_id: string;
  status: string;
}): Promise<ProductAssessmentRow> {
  const { data, error } = await supabase
    .from("srm_compliance_product_assessments")
    .insert(row)
    .select("id, product_id, requirement_id, status")
    .single();
  if (error) throw error;
  return data as ProductAssessmentRow;
}

export async function listMonitoringSources(): Promise<MonitoringSourceRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_monitoring_sources")
    .select("id, code, name, source_type, is_active")
    .order("code");
  if (error) throw error;
  return (data ?? []) as MonitoringSourceRow[];
}

export async function listMonitoringHits(): Promise<MonitoringHitRow[]> {
  const { data, error } = await supabase
    .from("srm_compliance_monitoring_hits")
    .select("id, source_id, title, severity, review_status, source_url, confidence")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonitoringHitRow[];
}

export async function listMonitoringIncidents(): Promise<MonitoringIncidentRow[]> {
  const { data, error } = await supabase.from("srm_compliance_monitoring_incidents").select("id, payload");
  if (error) throw error;
  return (data ?? []).map((r: { id: string; payload: Record<string, unknown> }) => ({
    id: r.id,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

export async function insertMonitoringHit(row: {
  source_id: string | null;
  title: string;
  severity: string | null;
  review_status: string;
  source_url: string;
  confidence: number;
}): Promise<MonitoringHitRow> {
  const { data, error } = await supabase
    .from("srm_compliance_monitoring_hits")
    .insert(row)
    .select("id, source_id, title, severity, review_status, source_url, confidence")
    .single();
  if (error) throw error;
  return data as MonitoringHitRow;
}
