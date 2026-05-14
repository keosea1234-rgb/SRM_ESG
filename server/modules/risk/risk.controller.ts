// Controller for risk assessments — HTTP request parsing and response shaping.
import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import {
  getAssessmentsForSupplier, getAssessmentById, createAssessment,
  editAssessment, removeAssessment, getLatestAssessmentsSummary,
} from "./risk.service";
import logger from "../../shared/logger";
import { AppError, NotFoundError, ValidationError } from "../../shared/errors";
import { createRiskSchema, updateRiskSchema } from './risk.schema';

export async function listAssessmentsHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getAssessmentsForSupplier(req.params.supplierId as string);
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function getAssessmentHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getAssessmentById(req.params.assessmentId as string);
    if (!data) return sendError(res, 404, "Assessment not found");
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

/** GET /api/risk/:id — same payload as nested assessments route. */
export async function getRiskByIdHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getAssessmentById(req.params.id as string);
    if (!data) return sendError(res, 404, "Assessment not found");
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function createAssessmentHandler(req: AuthRequest, res: Response) {
  try {
    const parsed = createRiskSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Validation failed");
    const { financial_risk, operational_risk, compliance_risk,
            geopolitical_risk, reputational_risk, assessment_date, notes } = parsed.data;
    const { supplierId } = req.params;
    const data = await createAssessment({
      supplier_id: supplierId as string,
      ...(assessment_date != null && assessment_date !== ""
        ? { assessment_date }
        : {}),
      financial_risk,
      operational_risk,
      compliance_risk,
      geopolitical_risk,
      reputational_risk,
      notes,
      assessed_by: req.userId,
    });
    sendSuccess(res, data, 201);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function updateAssessmentHandler(req: AuthRequest, res: Response) {
  try {
    const parsed = updateRiskSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Validation failed");
    const data = await editAssessment(req.params.assessmentId as string, parsed.data);
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function deleteAssessmentHandler(req: AuthRequest, res: Response) {
  try {
    await removeAssessment(req.params.assessmentId as string);
    sendSuccess(res, { success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function assessmentsSummaryHandler(req: AuthRequest, res: Response) {
  try {
    sendSuccess(res, await getLatestAssessmentsSummary());
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}
