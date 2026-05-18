import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { parseSpendSummaryFilters } from "./spend.schema";
import { getSpendSummaryService } from "./spend.service";

export async function getSpendSummaryHandler(req: AuthRequest, res: Response) {
  try {
    const filters = parseSpendSummaryFilters(req.query);
    const result = await getSpendSummaryService(filters);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}
