// Routes for performance evaluations — summary + supplier-scoped CRUD (mounted at /api).
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimiter";
import { requireRole } from "../../middleware/requireRole.js";
import {
  listEvaluationsHandler, getEvaluationHandler, getPerformanceByIdHandler, createEvaluationHandler,
  updateEvaluationHandler, deleteEvaluationHandler, evaluationsSummaryHandler,
} from "./performance.controller";

const performanceRouter = Router();
performanceRouter.use(requireAuth);

// Summary across all suppliers
performanceRouter.get("/performance/summary", evaluationsSummaryHandler);
performanceRouter.get("/performance/:id", getPerformanceByIdHandler);

// Supplier-scoped evaluations
performanceRouter.get("/suppliers/:supplierId/evaluations", listEvaluationsHandler);
performanceRouter.post(
  "/suppliers/:supplierId/evaluations",
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  createEvaluationHandler
);
performanceRouter.get("/suppliers/:supplierId/evaluations/:evaluationId", getEvaluationHandler);
performanceRouter.put(
  "/suppliers/:supplierId/evaluations/:evaluationId",
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  updateEvaluationHandler
);
performanceRouter.delete(
  "/suppliers/:supplierId/evaluations/:evaluationId",
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  deleteEvaluationHandler
);

export default performanceRouter;
