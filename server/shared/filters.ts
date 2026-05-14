import { z } from 'zod';

export interface SupplierFilters {
  search?: string;
  status?: string;
}

export interface ContractFilters {
  search?: string;
  status?: string;
}

const supplierFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'pending', 'suspended', 'blacklisted']).optional(),
});

export function parseSupplierFilters(
  query: Record<string, unknown>
): SupplierFilters {
  const result = supplierFiltersSchema.safeParse(query);
  return result.success ? result.data : {};
}

const contractFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(['draft', 'active', 'expired', 'terminated']).optional(),
});

export function parseContractFilters(
  query: Record<string, unknown>
): ContractFilters {
  const result = contractFiltersSchema.safeParse(query);
  return result.success ? result.data : {};
}
