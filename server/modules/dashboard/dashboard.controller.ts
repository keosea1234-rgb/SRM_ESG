// server/modules/dashboard/dashboard.controller.ts
import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { getDashboardOverview } from "./dashboard.service";

// BFF endpoint — single call returns all dashboard data
export async function getDashboardOverviewHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const industry = typeof req.query.industry === "string" ? req.query.industry : undefined;
    const result = await getDashboardOverview(industry);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err as Error);
  }
}
