// Contains contract business logic used by controllers.
import {
  ContractSummary,
  listContracts as listContractsRepository,
  getContractById as getContractByIdRepository,
  createContract as createContractRepository,
  updateContract as updateContractRepository,
  deleteContract as deleteContractRepository,
} from "./contracts.repository";
import {
  type PaginationParams,
  type PaginatedResult,
} from "../../shared/pagination";
import type { ContractFilters } from '../../shared/filters';

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

// Returns paginated contracts.
export async function getContractsService(
  params: PaginationParams,
  filters: ContractFilters = {}
): Promise<ServiceResult<PaginatedResult<ContractSummary>>> {
  try {
    const result = await listContractsRepository(params, filters);
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message ?? 'Failed to fetch contracts' };
  }
}

export async function getContractByIdService(
  id: string
): Promise<ServiceResult<ContractSummary | null>> {
  try {
    const contract = await getContractByIdRepository(id);
    return { ok: true, data: contract };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message ?? "Failed to fetch contract" };
  }
}

export async function createContractService(
  payload: Partial<ContractSummary>
): Promise<ServiceResult<ContractSummary>> {
  try {
    const contract = await createContractRepository(payload);
    return { ok: true, data: contract };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message ?? "Failed to create contract" };
  }
}

export async function updateContractService(
  id: string,
  payload: Partial<ContractSummary>
): Promise<ServiceResult<ContractSummary>> {
  try {
    const contract = await updateContractRepository(id, payload);
    return { ok: true, data: contract };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message ?? "Failed to update contract" };
  }
}

export async function deleteContractService(id: string): Promise<ServiceResult<null>> {
  try {
    await deleteContractRepository(id);
    return { ok: true, data: null };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message ?? "Failed to delete contract" };
  }
}
