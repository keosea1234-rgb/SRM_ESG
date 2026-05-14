// Service layer for performance evaluations — business logic and validation.
import {
  findEvaluationsBySupplier, findEvaluationById, insertEvaluation,
  updateEvaluation, deleteEvaluation, findLatestEvaluationsAllSuppliers,
  CreatePerformanceEvaluationInput, PerformanceEvaluationRow,
} from "./performance.repository";
import { insertSupplierActivityLog } from "../suppliers/suppliers.repository";
import logger from "../../shared/logger";

function validateScores(q: number, d: number, p: number, c: number) {
  for (const [name, val] of [["quality_score", q], ["delivery_score", d], ["price_score", p], ["communication_score", c]] as [string, number][]) {
    if (val < 0 || val > 10) throw new Error(`${name} must be between 0 and 10`);
  }
}

function validateWeights(qw: number, dw: number, pw: number, cw: number) {
  const sum = qw + dw + pw + cw;
  if (Math.abs(sum - 1.0) > 0.01) throw new Error(`Weights must sum to 1.00 — current sum is ${sum.toFixed(2)}`);
}

/** Weighted average of sub-scores (0–10) stored as 0–100 in DB, matching insert-time convention. */
function computeOverallScore(
  quality_score: number,
  delivery_score: number,
  price_score: number,
  communication_score: number,
  quality_weight: number,
  delivery_weight: number,
  price_weight: number,
  communication_weight: number
): number {
  return Math.round(
    (quality_score * quality_weight +
      delivery_score * delivery_weight +
      price_score * price_weight +
      communication_score * communication_weight) *
      10
  );
}

export async function getEvaluationsForSupplier(supplierId: string) {
  return findEvaluationsBySupplier(supplierId);
}

export async function getEvaluationById(id: string) {
  return findEvaluationById(id);
}

export async function createEvaluation(input: CreatePerformanceEvaluationInput): Promise<PerformanceEvaluationRow> {
  const qw = input.quality_weight ?? 0.30;
  const dw = input.delivery_weight ?? 0.25;
  const pw = input.price_weight ?? 0.25;
  const cw = input.communication_weight ?? 0.20;
  validateScores(
    input.quality_score ?? 0,
    input.delivery_score ?? 0,
    input.price_score ?? 0,
    input.communication_score ?? 0,
  );
  validateWeights(qw, dw, pw, cw);

  const overall_score = computeOverallScore(
    input.quality_score ?? 0,
    input.delivery_score ?? 0,
    input.price_score ?? 0,
    input.communication_score ?? 0,
    qw,
    dw,
    pw,
    cw
  );

  const evaluation = await insertEvaluation({
    ...input,
    quality_weight: qw,
    delivery_weight: dw,
    price_weight: pw,
    communication_weight: cw,
    overall_score,
  });

  await insertSupplierActivityLog({
    supplier_id: input.supplier_id,
    entity_type: "supplier",
    entity_id: evaluation.id,
    action: "created",
    description: `Performance evaluation created for period ${input.evaluation_period} — overall score: ${evaluation.overall_score}`,
    performed_by: input.evaluated_by ?? null,
  });

  logger.info({ supplierId: input.supplier_id, period: input.evaluation_period }, "Performance evaluation created");
  return evaluation;
}

export async function editEvaluation(id: string, input: Partial<CreatePerformanceEvaluationInput>): Promise<PerformanceEvaluationRow> {
  const existing = await findEvaluationById(id);
  if (!existing) throw new Error("Evaluation not found");

  const merged = {
    quality_score: input.quality_score ?? existing.quality_score,
    delivery_score: input.delivery_score ?? existing.delivery_score,
    price_score: input.price_score ?? existing.price_score,
    communication_score: input.communication_score ?? existing.communication_score,
    quality_weight: input.quality_weight ?? existing.quality_weight,
    delivery_weight: input.delivery_weight ?? existing.delivery_weight,
    price_weight: input.price_weight ?? existing.price_weight,
    communication_weight: input.communication_weight ?? existing.communication_weight,
  };
  validateScores(merged.quality_score, merged.delivery_score, merged.price_score, merged.communication_score);
  validateWeights(merged.quality_weight, merged.delivery_weight, merged.price_weight, merged.communication_weight);

  const overall_score = computeOverallScore(
    merged.quality_score,
    merged.delivery_score,
    merged.price_score,
    merged.communication_score,
    merged.quality_weight,
    merged.delivery_weight,
    merged.price_weight,
    merged.communication_weight
  );

  return updateEvaluation(id, { ...input, overall_score });
}

export async function removeEvaluation(id: string): Promise<unknown> {
  return deleteEvaluation(id);
}

export async function getLatestEvaluationsSummary() {
  const result = await findLatestEvaluationsAllSuppliers();
  const rows = result.data ?? [];
  const seen = new Set<string>();
  const deduped = (rows as PerformanceEvaluationRow[]).filter((r) => {
    const sid = r.supplier_id;
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
  return { ...result, data: deduped };
}
