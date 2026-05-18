import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { getSpendSummaryHandler } from "./spend.controller";

const spendRouter = Router();
spendRouter.use(requireAuth);

spendRouter.get(
  "/spend/summary",
  requireRole("admin", "procurement_manager"),
  getSpendSummaryHandler
);

export default spendRouter;
