import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { approveSupplier, rejectSupplier } from "./approval.service";
import { transitionOnboardingStatus } from "./onboarding.service";

// Handles approving a supplier.
export async function approveSupplierHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return sendError(res, 401, "Missing authenticated user");
    }

    const result = await approveSupplier(req.params.id as string, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

// Handles rejecting a supplier.
export async function rejectSupplierHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return sendError(res, 401, "Missing authenticated user");
    }

    const result = await rejectSupplier(req.params.id as string, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

export async function submitForReviewHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await transitionOnboardingStatus(
      req.params.id as string,
      "submitted",
      req.userId
    );
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}
