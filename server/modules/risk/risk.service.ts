// Service layer for risk assessments — business logic and validation.
import {
  findAssessmentsBySupplier, findAssessmentById, insertAssessment,
  updateAssessment, deleteAssessment, findLatestAssessmentsAllSuppliers,
  CreateRiskAssessmentInput, RiskAssessmentRow,
} from "./risk.repository";
import { insertSupplierActivityLog } from "../suppliers/suppliers.repository";
import logger from "../../shared/logger";

function validateRiskScores(
  financial: number,
  operational: number,
  compliance: number,
  geopolitical: number,
  reputational: number
) {
  const scores: [string, number][] = [
    ["financial_risk", financial],
    ["operational_risk", operational],
    ["compliance_risk", compliance],
    ["geopolitical_risk", geopolitical],
    ["reputational_risk", reputational],
  ];
  for (const [name, val] of scores) {
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      throw new Error(`${name} must be an integer between 1 and 5`);
    }
  }
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAssessmentsForSupplier(supplierId: string) {
  return findAssessmentsBySupplier(supplierId, { page: 1, limit: 100 });
}

export async function getAssessmentById(id: string) {
  return findAssessmentById(id);
}

export async function createAssessment(input: CreateRiskAssessmentInput): Promise<RiskAssessmentRow> {
  const assessment_date = input.assessment_date || todayDateString();
  validateRiskScores(
    input.financial_risk,
    input.operational_risk,
    input.compliance_risk,
    input.geopolitical_risk,
    input.reputational_risk
  );

  const assessment = await insertAssessment({ ...input, assessment_date });

  // @ts-expect-error — activity log insert uses risk entity; repository types are supplier-scoped.
  await insertSupplierActivityLog({
    supplier_id: input.supplier_id,
    entity_type: "risk_assessment",
    entity_id: assessment.id,
    action: "created",
    description: `Risk assessment created — overall level: ${assessment.overall_risk_level}`,
    performed_by: input.assessed_by,
  });

  logger.info({ supplierId: input.supplier_id, assessmentDate: assessment_date }, "Risk assessment created");
  return assessment;
}

export async function editAssessment(id: string, input: Partial<CreateRiskAssessmentInput>): Promise<RiskAssessmentRow> {
  const existing = await findAssessmentById(id);
  if (!existing) throw new Error("Assessment not found");

  const merged = {
    financial_risk: input.financial_risk ?? existing.financial_risk,
    operational_risk: input.operational_risk ?? existing.operational_risk,
    compliance_risk: input.compliance_risk ?? existing.compliance_risk,
    geopolitical_risk: input.geopolitical_risk ?? existing.geopolitical_risk,
    reputational_risk: input.reputational_risk ?? existing.reputational_risk,
  };
  validateRiskScores(
    merged.financial_risk,
    merged.operational_risk,
    merged.compliance_risk,
    merged.geopolitical_risk,
    merged.reputational_risk
  );

  return updateAssessment(id, input);
}

export async function removeAssessment(id: string): Promise<void> {
  return deleteAssessment(id);
}

export async function getLatestAssessmentsSummary() {
  const result = await findLatestAssessmentsAllSuppliers();
  const rows = result.data ?? [];
  const seen = new Set<string>();
  const deduped = (rows as RiskAssessmentRow[]).filter((r) => {
    const sid = r.supplier_id;
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
  return { ...result, data: deduped };
}
