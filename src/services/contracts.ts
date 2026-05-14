import { apiGet } from "../lib/api";

export interface Contract {
  id: string;
  title: string;
  status: string;
  contract_type: string | null;
  category: string | null;
  supplier_name: string | null;
  contract_size: number | null;
  start_date: string | null;
  expiration_date: string | null;
}

export interface ContractsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Matches ContractsPage handling of array vs paginated envelope after apiGet unwrap. */
export type ContractsListResult = Contract[] | { data: Contract[]; pagination: ContractsPagination };

export async function fetchContracts(params: {
  page: number;
  search?: string;
  status?: string;
}): Promise<ContractsListResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("limit", "20");
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  return apiGet<ContractsListResult>(`/api/contracts?${searchParams.toString()}`);
}
