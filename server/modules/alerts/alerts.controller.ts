import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { listUnreadAlerts, markAlertRead } from "./alerts.service";

export async function getAlertsHandler(req: AuthRequest, res: Response) {
  try {
    const limitRaw = Number(req.query.limit ?? 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;
    const data = await listUnreadAlerts(limit);
    return sendSuccess(res, data);
  } catch (err: any) {
    return sendError(res, 500, err?.message ?? "Internal server error");
  }
}

export async function markReadHandler(req: AuthRequest, res: Response) {
  try {
    const result = await markAlertRead(String(req.params.id));
    if (!result.ok) return sendError(res, 500, result.error);
    return sendSuccess(res, { id: String(req.params.id), is_read: true });
  } catch (err: any) {
    return sendError(res, 500, err?.message ?? "Internal server error");
  }
}
