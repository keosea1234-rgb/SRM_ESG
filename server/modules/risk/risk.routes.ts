// Routes for risk assessments — nested under /suppliers/:supplierId/assessments.
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimiter";
import { requireRole } from "../../middleware/requireRole.js";
import {
  listAssessmentsHandler, getAssessmentHandler, getRiskByIdHandler, createAssessmentHandler,
  updateAssessmentHandler, deleteAssessmentHandler, assessmentsSummaryHandler,
} from "./risk.controller";

const riskRouter = Router();
riskRouter.use(requireAuth);

riskRouter.get("/summary", assessmentsSummaryHandler);
riskRouter.get("/suppliers/:supplierId/assessments", listAssessmentsHandler);
riskRouter.post(
  "/suppliers/:supplierId/assessments",
  requireAuth,
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  createAssessmentHandler
);
riskRouter.get("/suppliers/:supplierId/assessments/:assessmentId", getAssessmentHandler);
riskRouter.put(
  "/suppliers/:supplierId/assessments/:assessmentId",
  requireAuth,
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  updateAssessmentHandler
);
riskRouter.delete(
  "/suppliers/:supplierId/assessments/:assessmentId",
  requireAuth,
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  deleteAssessmentHandler
);

// Must be last: :id must not shadow /summary or /suppliers/...
riskRouter.get("/:id", getRiskByIdHandler);

export default riskRouter;
