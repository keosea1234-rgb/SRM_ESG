import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendSuccess } from "../../middleware/errorHandler";
import {
  createCarbonRecord,
  createMaterialityAssessment,
  createMonitoringHit,
  createProductComplianceAssessment,
  getCarbonSummary,
  getMaterialitySummary,
  getMonitoringSummary,
  getProductComplianceSummary,
  getReportingCoverage,
  getRiskIndicatorSummary,
} from "./compliance.service";

export async function handleReportingCoverage(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getReportingCoverage();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleMaterialityGet(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getMaterialitySummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleMaterialityPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const created = await createMaterialityAssessment(req.body);
    sendSuccess(res, created, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleCarbonSummary(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getCarbonSummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleCarbonRecordPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await createCarbonRecord(req.body);
    sendSuccess(res, row, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleRiskIndicatorsSummary(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getRiskIndicatorSummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleProductComplianceSummary(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getProductComplianceSummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleProductAssessmentPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await createProductComplianceAssessment(req.body);
    sendSuccess(res, row, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleMonitoringGet(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getMonitoringSummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function handleMonitoringHitPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await createMonitoringHit(req.body);
    sendSuccess(res, row, 201);
  } catch (err) {
    next(err);
  }
}
