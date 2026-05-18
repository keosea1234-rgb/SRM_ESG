// Contains supplier business logic used by controllers.
import {
  createSupplier as createSupplierRepository,
  createSupplierContact as createSupplierContactRepository,
  getAllSuppliers as getAllSuppliersRepository,
  listSuppliers as listSuppliersRepository,
  getSupplierById as getSupplierByIdRepository,
  getSupplierContacts as getSupplierContactsRepository,
  getSupplierContracts as getSupplierContractsRepository,
  getSupplierForInvite,
  insertSupplierActivityLog,
  inviteSupplierByEmail,
  markSupplierInvited,
  Supplier,
  SupplierDetail,
  SupplierContact,
  SupplierContract,
  SupplierSummary,
  updateSupplier as updateSupplierRepository,
} from "./suppliers.repository";
import logger from "../../shared/logger";
import {
  parsePagination,
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";
import type { SupplierFilters } from '../../shared/filters';

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string; details?: unknown };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

// ── ACTIVITY LOG ─────────────────────────────────────────────────────────────

// Builds and writes a supplier activity log entry for create, update, and invite actions.
export async function logSupplierActivity(params: {
  action: "created" | "updated" | "invited";
  supplierId: string;
  name: string | null | undefined;
  performedBy: string | undefined;
  field_name?: string;
  old_value?: string;
  new_value?: string;
}): Promise<void> {
  const label = params.name?.trim() || params.supplierId;
  let description =
    params.action === "created"
      ? `Supplier "${label}" was created`
      : params.action === "invited"
        ? `Supplier "${label}" was invited`
        : `Supplier "${label}" was updated`;

  if (
    params.action === "updated" &&
    params.field_name &&
    (params.old_value !== undefined || params.new_value !== undefined)
  ) {
    description = `Supplier "${label}" was updated: ${params.field_name} (${String(params.old_value ?? "")} → ${String(params.new_value ?? "")})`;
  } else if (params.action === "updated" && params.field_name) {
    description = `Supplier "${label}" was updated: ${params.field_name}`;
  }

  const { error } = await insertSupplierActivityLog({
    supplier_id: params.supplierId,
    entity_type: "supplier",
    entity_id: params.supplierId,
    action: params.action,
    description,
    performed_by: params.performedBy ?? null,
  });

  if (error) {
    logger.error({ error }, "srm_activity_log insert failed");
  }
}

// ── LIST (paginated) ──────────────────────────────────────────────────────────

// Returns paginated suppliers. Called by the list endpoint with ?page & ?limit.
export async function getSuppliersService(
  params: PaginationParams,
  filters: SupplierFilters = {}
): Promise<ServiceResult<PaginatedResult<SupplierSummary>>> {
  try {
    const result = await listSuppliersRepository(params, filters);
    return { ok: true, data: result };
  } catch (err: any) {
    logger.error({ err }, 'getSuppliersService failed');
    return { ok: false, status: 500, error: err?.message ?? 'Failed to fetch suppliers' };
  }
}

// Returns all suppliers ordered by name — kept for backward compatibility with existing tests.
export async function getAllSuppliers(): Promise<ServiceResult<SupplierSummary[]>> {
  const { data, error } = await getAllSuppliersRepository();
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ── SINGLE ────────────────────────────────────────────────────────────────────

// Returns one supplier by id when found.
export async function getSupplierById(id: string): Promise<ServiceResult<SupplierDetail>> {
  const { data, error } = await getSupplierByIdRepository(id);
  if (error || !data) return { ok: false, status: 404, error: "Supplier not found" };
  return { ok: true, data };
}

// ── CONTACTS ─────────────────────────────────────────────────────────────────

// Returns all contacts for one supplier.
export async function getSupplierContacts(
  supplierId: string
): Promise<ServiceResult<SupplierContact[]>> {
  const { data, error } = await getSupplierContactsRepository(supplierId);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, data: data ?? [] };
}

// Creates a contact for one supplier.
export async function createSupplierContact(
  supplierId: string,
  payload: Record<string, unknown>
): Promise<ServiceResult<SupplierContact>> {
  const { data, error } = await createSupplierContactRepository(supplierId, payload);
  if (error || !data) return { ok: false, status: 400, error: error?.message ?? "Failed to create contact" };
  return { ok: true, data };
}

// ── CONTRACTS ─────────────────────────────────────────────────────────────────

// Returns all contracts for one supplier.
export async function getSupplierContracts(
  supplierId: string
): Promise<ServiceResult<SupplierContract[]>> {
  const { data, error } = await getSupplierContractsRepository(supplierId);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ── CREATE / UPDATE ───────────────────────────────────────────────────────────

// Creates a supplier and records a creation activity entry.
export async function createSupplier(
  payload: Record<string, unknown>,
  userId: string | undefined
): Promise<ServiceResult<Supplier>> {
  const { data, error } = await createSupplierRepository({ ...payload, created_by: userId });
  if (error || !data) return { ok: false, status: 400, error: error?.message ?? "Failed to create supplier" };

  await logSupplierActivity({
    action: "created",
    supplierId: data.id,
    name: data.name,
    performedBy: userId,
  });

  return { ok: true, data };
}

// Updates a supplier and records update activity (field-level detail goes in description when provided).
export async function updateSupplier(
  supplierId: string,
  payload: Record<string, unknown>,
  userId: string | undefined
): Promise<ServiceResult<Supplier>> {
  const fieldName = payload.field_name;
  const oldValue = payload.old_value;
  const newValue = payload.new_value;
  const updatePayload = { ...payload };
  delete updatePayload.field_name;
  delete updatePayload.old_value;
  delete updatePayload.new_value;

  const { data, error } = await updateSupplierRepository(supplierId, updatePayload);
  if (error || !data) return { ok: false, status: 400, error: error?.message ?? "Failed to update supplier" };

  await logSupplierActivity({
    action: "updated",
    supplierId: data.id,
    name: data.name,
    performedBy: userId,
    field_name: typeof fieldName === "string" ? fieldName : undefined,
    old_value: oldValue === undefined ? undefined : String(oldValue),
    new_value: newValue === undefined ? undefined : String(newValue),
  });

  return { ok: true, data };
}

// ── INVITE ────────────────────────────────────────────────────────────────────

// Invites a supplier user by email after validating supplier invite status.
export async function inviteSupplier(params: {
  supplierId: string;
  email: string;
  userId: string | undefined;
}): Promise<ServiceResult<{ success: true; email: string }>> {
  const { data: supplier, error: supplierError } = await getSupplierForInvite(params.supplierId);
  if (supplierError || !supplier) return { ok: false, status: 404, error: "Supplier not found" };

  if (supplier.invite_status === "registered") {
    return { ok: false, status: 400, error: "Supplier already registered" };
  }

  const { error: inviteError } = await inviteSupplierByEmail({
    email: params.email,
    supplierId: params.supplierId,
    supplierName: supplier.name ?? null,
  });

  if (inviteError) {
    return {
      ok: false,
      status: 500,
      error: inviteError.message,
      details: inviteError,
    };
  }

  await markSupplierInvited(params.supplierId, params.email);

  await logSupplierActivity({
    action: "invited",
    supplierId: params.supplierId,
    name: supplier.name,
    performedBy: params.userId,
  });

  return { ok: true, data: { success: true, email: params.email } };
}

// ── SERVICE ALIASES (used by controller) ─────────────────────────────────────
// These thin wrappers keep controller imports clean and consistent.

export async function getSupplierByIdService(id: string) {
  return getSupplierById(id);
}

export async function createSupplierService(
  payload: Record<string, unknown>,
  userId?: string
) {
  return createSupplier(payload, userId);
}

export async function updateSupplierService(
  id: string,
  payload: Record<string, unknown>,
  userId?: string
) {
  return updateSupplier(id, payload, userId);
}

export async function deleteSupplierService(_id: string) {
  // Delete is not implemented yet — placeholder to keep controller consistent
  return { ok: true as const, data: null };
}
