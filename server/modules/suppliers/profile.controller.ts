import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { createOrUpdateProfile, getProfile } from "./profile.service";
import { supabase } from "../../db/supabaseClient";

// Handles fetching one supplier profile by supplier id.
export async function getProfileHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await getProfile(req.params.id as string);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

// Handles upserting a supplier profile by supplier id.
// IDOR guard: supplier-role users may only edit their own linked supplier.
export async function upsertProfileHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const targetSupplierId = req.params.id as string;

    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, supplier_id")
      .eq("id", req.userId!)
      .single();

    if (profileError || !callerProfile) {
      return sendError(res, 403, "Forbidden");
    }

    if (
      callerProfile.role === "supplier" &&
      callerProfile.supplier_id !== targetSupplierId
    ) {
      return sendError(res, 403, "You can only edit your own supplier profile");
    }

    const result = await createOrUpdateProfile(
      targetSupplierId,
      req.body as Record<string, unknown>,
      req.userId
    );
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}
