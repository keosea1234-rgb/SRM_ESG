// Business logic for activity log.
import { findActivityLog, findDistinctActions, ActivityLogFilters, ActivityLogResult } from "./activity.repository";

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

// Returns paginated activity log with total count for pagination.
export async function getActivityLog(filters: ActivityLogFilters): Promise<ServiceResult<ActivityLogResult>> {
  try {
    const result = await findActivityLog(filters);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, status: 500, error: e instanceof Error ? e.message : "Failed to fetch activity log" };
  }
}

// Returns distinct action types for filter dropdown.
export async function getDistinctActions(): Promise<ServiceResult<string[]>> {
  try {
    const actions = await findDistinctActions();
    return { ok: true, data: actions };
  } catch (e) {
    return { ok: false, status: 500, error: e instanceof Error ? e.message : "Failed to fetch actions" };
  }
}

export async function getActivityLogsService(params: ActivityLogFilters) {
  return getActivityLog(params);
}

export async function getActivityLogsBySupplierService(
  supplierId: string,
  params: ActivityLogFilters
) {
  return getActivityLog({ ...params, supplierId });
}
