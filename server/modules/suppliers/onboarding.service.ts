import {
  getSupplierById,
  insertSupplierActivityLog,
  Supplier,
  updateSupplier,
} from "./suppliers.repository";
import { ServiceResult } from "./suppliers.service";

export type OnboardingStatus =
  | "not_invited"
  | "invited"
  | "registered"
  | "profile_filling"
  | "submitted"
  | "approved"
  | "rejected";

// Defines all allowed onboarding status transitions for suppliers.
const VALID_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  not_invited: ["invited"],
  invited: ["registered"],
  registered: ["profile_filling"],
  profile_filling: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: [],
  rejected: ["profile_filling"],
};

// Returns true when the onboarding status transition is permitted by the state machine.
function isValidTransition(
  currentStatus: OnboardingStatus,
  newStatus: OnboardingStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}

// Transitions supplier onboarding status after validating state-machine rules and logs the change.
export async function transitionOnboardingStatus(
  supplierId: string,
  newStatus: OnboardingStatus,
  performedBy: string | undefined
): Promise<ServiceResult<Supplier>> {
  const { data: supplier, error: supplierError } = await getSupplierById(supplierId);

  if (supplierError || !supplier) {
    return { ok: false, status: 404, error: "Supplier not found" };
  }

  const currentStatus =
    ((supplier as Supplier & { onboarding_status?: OnboardingStatus | null })
      .onboarding_status ?? "not_invited") as OnboardingStatus;

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
    };
  }

  const { data: updatedSupplier, error: updateError } = await updateSupplier(supplierId, {
    onboarding_status: newStatus,
  });

  if (updateError || !updatedSupplier) {
    return {
      ok: false,
      status: 400,
      error: updateError?.message ?? "Failed to update onboarding status",
    };
  }

  await insertSupplierActivityLog({
    supplier_id: supplierId,
    entity_type: "supplier",
    entity_id: supplierId,
    action: "updated",
    description: `Onboarding status changed: ${currentStatus} → ${newStatus}`,
    performed_by: performedBy ?? null,
  });

  return { ok: true, data: updatedSupplier };
}
