// server/modules/esg/esg.controller.ts
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { getRequestLogger } from "../../shared/logger";
import { EsgAssessmentCreateSchema } from "./esg.schema";
import {
  createEsgAssessment,
  getAssessmentHistory,
  getEsgBySupplier,
  getEsgHotspots,
  getEsgLeaderboard,
  getEsgSummary,
} from "./esg.service";

export async function handleGetHotspots(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const hotspots = await getEsgHotspots();
    sendSuccess(res, hotspots);
  } catch (err) {
    next(err);
  }
}

export async function handleGetSummary(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const summary = await getEsgSummary();
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function handleGetLeaderboard(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const leaderboard = await getEsgLeaderboard();
    sendSuccess(res, leaderboard);
  } catch (err) {
    next(err);
  }
}

export async function handleGetBySupplier(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const supplierId = String(req.params.supplierId);
    const data = await getEsgBySupplier(supplierId);
    if (!data)
      return sendSuccess(res, null);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetAssessmentHistory(
  req: AuthRequest,
  res: Response
) {
  try {
    const data = await getAssessmentHistory(req.params.supplierId);
    return sendSuccess(res, data);
  } catch {
    return sendError(res, 500, "Failed to fetch ESG history");
  }
}

export async function handleCreateAssessment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const supplierId = String(req.params.supplierId);
  const reqLogger = getRequestLogger(
    (res.locals.correlationId as string) ?? "no-id"
  );
  try {
    // FIX: was (req as any).user?.id — auth middleware sets req.userId
    const userId = req.userId ? String(req.userId) : null;

    const parsed = EsgAssessmentCreateSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, JSON.stringify(parsed.error.flatten()));

    const data = await createEsgAssessment(supplierId, userId ?? "", parsed.data);
    reqLogger.info({ supplierId }, "ESG assessment created");
    sendSuccess(res, data, 201);
  } catch (err) {
    reqLogger.error({ err, supplierId }, "ESG assessment creation failed");
    next(err);
  }
}
