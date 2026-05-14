// server/shared/pagination.ts
// Shared pagination utility — used by all list endpoints
// Single source of truth: fix here, fixed everywhere

export interface PaginationParams {
  page: number;   // 1-based
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500; // prevent abuse

/**
 * Parse and validate pagination query params from Express request.
 * Falls back to safe defaults if params are missing or invalid.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = parseInt(String(query.page ?? DEFAULT_PAGE), 10);
  const rawLimit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= MAX_LIMIT
      ? rawLimit
      : DEFAULT_LIMIT;

  return { page, limit };
}

/**
 * Calculate Supabase .range() start/end from pagination params.
 * Supabase range is 0-based and inclusive on both ends.
 */
export function toRange(params: PaginationParams): { from: number; to: number } {
  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  return { from, to };
}

/**
 * Build the standard pagination meta object for API responses.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/**
 * Wrap data + pagination meta into the standard paginated response shape.
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    pagination: buildPaginationMeta(total, params),
  };
}
