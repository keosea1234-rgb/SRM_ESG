import { ServiceResult } from "./suppliers.service";
import {
  createProfile,
  getProfileBySupplierId,
  SupplierProfile,
  updateProfile,
} from "./profile.repository";

// Gets the supplier profile for a supplier id.
export async function getProfile(
  supplierId: string
): Promise<ServiceResult<SupplierProfile>> {
  const { data, error } = await getProfileBySupplierId(supplierId);

  if (error || !data) {
    return { ok: false, status: 404, error: "Supplier profile not found" };
  }

  return { ok: true, data };
}

// Creates or updates a supplier profile based on whether one already exists.
export async function createOrUpdateProfile(
  supplierId: string,
  payload: Record<string, unknown>,
  _userId: string | undefined
): Promise<ServiceResult<SupplierProfile>> {
  const existing = await getProfileBySupplierId(supplierId);

  if (existing.error && existing.error.code !== "PGRST116") {
    return { ok: false, status: 500, error: existing.error.message };
  }

  if (existing.data) {
    const { data, error } = await updateProfile(supplierId, payload);
    if (error || !data) {
      return { ok: false, status: 400, error: error?.message ?? "Failed to update profile" };
    }
    return { ok: true, data };
  }

  const { data, error } = await createProfile(supplierId, payload);
  if (error || !data) {
    return { ok: false, status: 400, error: error?.message ?? "Failed to create profile" };
  }

  return { ok: true, data };
}
