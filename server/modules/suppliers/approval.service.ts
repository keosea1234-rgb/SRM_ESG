import { updateProfile } from "./profile.repository";
import { transitionOnboardingStatus } from "./onboarding.service";
import { Supplier } from "./suppliers.repository";
import { ServiceResult } from "./suppliers.service";

// Approves a supplier by transitioning onboarding status and storing approval metadata on the supplier profile.
export async function approveSupplier(
  supplierId: string,
  userId: string
): Promise<ServiceResult<Supplier>> {
  const transitionResult = await transitionOnboardingStatus(
    supplierId,
    "approved",
    userId
  );

  if (!transitionResult.ok) {
    return transitionResult;
  }

  const { error } = await updateProfile(supplierId, {
    approved_at: new Date().toISOString(),
    approved_by: userId,
  });

  if (error) {
    return { ok: false, status: 400, error: error.message };
  }

  return transitionResult;
}

// Rejects a supplier by transitioning onboarding status to rejected.
export async function rejectSupplier(
  supplierId: string,
  userId: string
): Promise<ServiceResult<Supplier>> {
  return transitionOnboardingStatus(supplierId, "rejected", userId);
}