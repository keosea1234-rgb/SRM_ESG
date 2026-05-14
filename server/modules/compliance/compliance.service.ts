import * as repo from "./compliance.repository";
import type {
  MaterialityAssessmentCreate,
  CarbonRecordCreate,
  ProductComplianceAssessmentCreate,
  MonitoringHitCreate,
} from "./compliance.schema";

function countBy<T extends string | number | symbol>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of items) {
    const key = String(k);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function getReportingCoverage() {
  const [frameworks, requirements, evidence] = await Promise.all([
    repo.listFrameworks(),
    repo.listReportingRequirements(),
    repo.listReportingEvidence(),
  ]);

  const evidenceByReq = new Set(evidence.map((e) => e.requirement_id));
  const response_status_counts: Record<string, number> = {};
  for (const r of requirements) {
    response_status_counts[r.response_status] = (response_status_counts[r.response_status] ?? 0) + 1;
  }

  let missing_evidence_count = 0;
  for (const r of requirements) {
    if (r.is_mapped && !evidenceByReq.has(r.id)) missing_evidence_count += 1;
  }

  return {
    frameworks: frameworks.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      status: f.status,
    })),
    total_requirements: requirements.length,
    mapped_requirements: requirements.filter((r) => r.is_mapped).length,
    response_status_counts,
    evidence_count: evidence.length,
    missing_evidence_count,
    requirements: requirements.map((r) => ({
      id: r.id,
      requirement_code: r.requirement_code,
      title: r.title,
      pillar: r.pillar,
    })),
  };
}

export async function getMaterialitySummary() {
  const [assessments, topics] = await Promise.all([
    repo.listMaterialityAssessments(),
    repo.listMaterialityTopics(),
  ]);

  return {
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      reporting_period: a.reporting_period,
      status: a.status,
      threshold: num(a.threshold),
    })),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      impact_score: num(t.impact_score),
      financial_score: num(t.financial_score),
      is_material: Boolean(t.is_material),
    })),
    material_topics_count: topics.filter((t) => t.is_material).length,
  };
}

export async function createMaterialityAssessment(body: MaterialityAssessmentCreate) {
  const threshold = body.threshold ?? 2.5;
  const status = body.status ?? "draft";
  const created = await repo.insertMaterialityAssessment({
    title: body.title,
    reporting_period: body.reporting_period,
    status,
    threshold,
  });

  if (body.topics?.length) {
    await repo.insertMaterialityTopics(
      body.topics.map((t) => ({
        assessment_id: created.id,
        title: t.title,
        category: t.category,
        impact_score: t.impact_score ?? 0,
        financial_score: t.financial_score ?? 0,
        is_material: t.is_material ?? false,
      }))
    );
  }

  return created;
}

export async function getCarbonSummary() {
  const [records, sbti, footprints] = await Promise.all([
    repo.listCarbonRecords(),
    repo.listSbtiTargets(),
    repo.listProductFootprints(),
  ]);

  const total_tco2e = records.reduce((s, r) => s + num(r.tco2e), 0);
  const scope3 = records.filter((r) => r.scope === "scope3");
  const scope3_tco2e = scope3.reduce((s, r) => s + num(r.tco2e), 0);
  const scope3_by_category: Record<string, number> = {};
  for (const r of scope3) {
    const cat = r.category ?? "uncategorized";
    scope3_by_category[cat] = (scope3_by_category[cat] ?? 0) + num(r.tco2e);
  }
  const data_quality_counts: Record<string, number> = {};
  for (const r of records) {
    const dq = r.data_quality || "unknown";
    data_quality_counts[dq] = (data_quality_counts[dq] ?? 0) + 1;
  }

  return {
    total_tco2e,
    scope3_tco2e,
    scope3_by_category,
    data_quality_counts,
    sbti_targets: sbti.map((r) => r.payload as Record<string, unknown>),
    product_footprints: footprints.map((r) => r.payload as Record<string, unknown>),
  };
}

export async function createCarbonRecord(body: CarbonRecordCreate) {
  return repo.insertCarbonRecord({
    scope: body.scope,
    category: body.category ?? null,
    tco2e: body.tco2e,
    data_quality: body.data_quality ?? "estimated",
  });
}

export async function getRiskIndicatorSummary() {
  const [indicators, scores] = await Promise.all([repo.listRiskIndicators(), repo.listRiskScoreRows()]);

  const supplierScores = scores.filter((s) => s.kind === "supplier" && s.score != null).map((s) => num(s.score));
  const average_score =
    supplierScores.length > 0 ? supplierScores.reduce((a, b) => a + b, 0) / supplierScores.length : null;

  const category_keys = indicators.map((i) => i.category);
  const category_counts = countBy(category_keys);

  return {
    total_indicators: indicators.length,
    active_indicators: indicators.filter((i) => i.is_active).length,
    category_counts,
    supplier_score_count: scores.filter((s) => s.kind === "supplier").length,
    average_score,
    tier_relationship_count: scores.filter((s) => s.kind === "tier").length,
    country_score_count: scores.filter((s) => s.kind === "country").length,
    sector_score_count: scores.filter((s) => s.kind === "sector").length,
    indicators: indicators.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.category,
      weight: num(i.weight),
      source_type: i.source_type,
    })),
  };
}

export async function getProductComplianceSummary() {
  const [products, requirements, assessments] = await Promise.all([
    repo.listProducts(),
    repo.listProductRequirements(),
    repo.listProductAssessments(),
  ]);

  const assessment_status_counts: Record<string, number> = {};
  for (const a of assessments) {
    assessment_status_counts[a.status] = (assessment_status_counts[a.status] ?? 0) + 1;
  }

  return {
    product_count: products.length,
    requirement_count: requirements.length,
    assessment_status_counts,
    critical_requirement_count: requirements.filter((r) => r.criticality === "critical").length,
    requirements: requirements.map((r) => ({
      id: r.id,
      regulation_code: r.regulation_code,
      requirement_code: r.requirement_code,
      title: r.title,
      criticality: r.criticality,
    })),
  };
}

export async function createProductComplianceAssessment(body: ProductComplianceAssessmentCreate) {
  return repo.insertProductAssessment({
    product_id: body.product_id,
    requirement_id: body.requirement_id,
    status: body.status ?? "pending",
  });
}

export async function getMonitoringSummary() {
  const [sources, hits, incidents] = await Promise.all([
    repo.listMonitoringSources(),
    repo.listMonitoringHits(),
    repo.listMonitoringIncidents(),
  ]);

  const review_status_counts = countBy(hits.map((h) => h.review_status));
  const severity_keys = hits.map((h) => h.severity ?? "unknown");
  const severity_counts = countBy(severity_keys);

  return {
    sources: sources.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      source_type: s.source_type,
      is_active: s.is_active,
    })),
    hits: hits.map((h) => ({
      id: h.id,
      title: h.title,
      severity: h.severity,
      review_status: h.review_status,
      source_url: h.source_url,
      confidence: num(h.confidence),
    })),
    incidents: incidents.map((i) => i.payload),
    review_status_counts,
    severity_counts,
  };
}

export async function createMonitoringHit(body: MonitoringHitCreate) {
  return repo.insertMonitoringHit({
    source_id: body.source_id ?? null,
    title: body.title,
    severity: body.severity ?? null,
    review_status: body.review_status ?? "new",
    source_url: body.source_url ?? "",
    confidence: body.confidence ?? 0,
  });
}
