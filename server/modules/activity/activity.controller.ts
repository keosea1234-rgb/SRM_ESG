// server/modules/activity/activity.controller.ts
import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import logger from "../../shared/logger";
import { z } from 'zod';
import { getActivityLog, getDistinctActions } from "./activity.service";

const activityQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/activity-log?page=1&limit=20
export async function getActivityLogHandler(req: AuthRequest, res: Response) {
  try {
    const parsed = activityQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, 'Invalid query parameters');
    const filters = parsed.data;
    const result = await getActivityLog(filters);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    logger.error({ err }, "getActivityLogHandler error");
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// GET /api/activity-log/actions
export async function getDistinctActionsHandler(req: AuthRequest, res: Response) {
  try {
    const result = await getDistinctActions();
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    logger.error({ err }, "getDistinctActionsHandler error");
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}
