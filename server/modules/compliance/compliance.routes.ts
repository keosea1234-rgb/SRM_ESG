import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimiter";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate";
import {
  CarbonRecordCreateSchema,
  MaterialityAssessmentCreateSchema,
  MonitoringHitCreateSchema,
  ProductComplianceAssessmentCreateSchema,
} from "./compliance.schema";
import {
  handleCarbonRecordPost,
  handleCarbonSummary,
  handleMaterialityGet,
  handleMaterialityPost,
  handleMonitoringGet,
  handleMonitoringHitPost,
  handleProductAssessmentPost,
  handleProductComplianceSummary,
  handleReportingCoverage,
  handleRiskIndicatorsSummary,
} from "./compliance.controller";

const complianceRouter = Router();
complianceRouter.use(requireAuth);
complianceRouter.use(requireRole("admin", "procurement_manager", "esg_analyst"));

complianceRouter.get("/compliance/reporting/coverage", handleReportingCoverage);
complianceRouter.get("/compliance/materiality", handleMaterialityGet);
complianceRouter.post(
  "/compliance/materiality",
  writeLimiter,
  validate(MaterialityAssessmentCreateSchema),
  handleMaterialityPost
);
complianceRouter.get("/compliance/carbon/summary", handleCarbonSummary);
complianceRouter.post(
  "/compliance/carbon/records",
  writeLimiter,
  validate(CarbonRecordCreateSchema),
  handleCarbonRecordPost
);
complianceRouter.get("/compliance/risk-indicators/summary", handleRiskIndicatorsSummary);
complianceRouter.get("/compliance/product-compliance/summary", handleProductComplianceSummary);
complianceRouter.post(
  "/compliance/product-compliance/assessments",
  writeLimiter,
  validate(ProductComplianceAssessmentCreateSchema),
  handleProductAssessmentPost
);
complianceRouter.get("/compliance/monitoring", handleMonitoringGet);
complianceRouter.post(
  "/compliance/monitoring/hits",
  writeLimiter,
  validate(MonitoringHitCreateSchema),
  handleMonitoringHitPost
);

export default complianceRouter;
