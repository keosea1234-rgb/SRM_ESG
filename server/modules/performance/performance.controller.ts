// Controller for performance evaluations — HTTP request parsing and response shaping.
import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import {
  getEvaluationsForSupplier, getEvaluationById, createEvaluation,
  editEvaluation, removeEvaluation, getLatestEvaluationsSummary,
} from "./performance.service";
import logger from "../../shared/logger";
import { AppError, NotFoundError, ValidationError } from "../../shared/errors";
import { createPerformanceSchema, updatePerformanceSchema } from './performance.schema';
import { validate } from '../../middleware/validate';

export async function listEvaluationsHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getEvaluationsForSupplier(req.params.supplierId as string);
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function getEvaluationHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getEvaluationById(req.params.evaluationId as string);
    if (!data) return sendError(res, 404, "Evaluation not found");
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

/** GET /api/performance/:id — same payload as nested evaluations route. */
export async function getPerformanceByIdHandler(req: AuthRequest, res: Response) {
  try {
    const data = await getEvaluationById(req.params.id as string);
    if (!data) return sendError(res, 404, "Evaluation not found");
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function createEvaluationHandler(req: AuthRequest, res: Response) {
  try {
    const parsed = createPerformanceSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Validation failed");
    const { evaluation_period, quality_score, delivery_score, price_score,
            communication_score, quality_weight, delivery_weight,
            price_weight, communication_weight, notes } = parsed.data;
    const data = await createEvaluation({
      supplier_id: req.params.supplierId as string,
      evaluation_period,
      quality_score,
      delivery_score,
      price_score,
      communication_score,
      quality_weight,
      delivery_weight,
      price_weight,
      communication_weight,
      notes,
      evaluated_by: req.userId,
    });
    sendSuccess(res, data, 201);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function updateEvaluationHandler(req: AuthRequest, res: Response) {
  try {
    const parsed = updatePerformanceSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Validation failed");
    const data = await editEvaluation(req.params.evaluationId as string, parsed.data);
    sendSuccess(res, data);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function deleteEvaluationHandler(req: AuthRequest, res: Response) {
  try {
    await removeEvaluation(req.params.evaluationId as string);
    sendSuccess(res, null, 204);
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}

export async function evaluationsSummaryHandler(req: AuthRequest, res: Response) {
  try {
    sendSuccess(res, await getLatestEvaluationsSummary());
  } catch (err: unknown) {
    if (err instanceof AppError) return sendError(res, err.statusCode, err.message, err.code);
    return sendError(res, 500, (err as Error).message);
  }
}
