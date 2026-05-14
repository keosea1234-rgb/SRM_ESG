import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../db/supabaseClient";

type RepositoryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

export interface SupplierProfile {
  supplier_id: string;
  [key: string]: unknown;
}

// Gets a supplier profile by supplier id.
export async function getProfileBySupplierId(
  supplierId: string
): Promise<RepositoryResult<SupplierProfile>> {
  const { data, error } = await supabase
    .from("srm_supplier_profiles")
    .select("*")
    .eq("supplier_id", supplierId)
    .single();

  return { data: (data as SupplierProfile | null) ?? null, error };
}

// Creates a supplier profile for a supplier id.
export async function createProfile(
  supplierId: string,
  payload: Record<string, unknown>
): Promise<RepositoryResult<SupplierProfile>> {
  const { data, error } = await supabase
    .from("srm_supplier_profiles")
    .insert({ ...payload, supplier_id: supplierId })
    .select()
    .single();

  return { data: (data as SupplierProfile | null) ?? null, error };
}

// Updates a supplier profile by supplier id.
export async function updateProfile(
  supplierId: string,
  payload: Record<string, unknown>
): Promise<RepositoryResult<SupplierProfile>> {
  const { data, error } = await supabase
    .from("srm_supplier_profiles")
    .update(payload)
    .eq("supplier_id", supplierId)
    .select()
    .single();

  return { data: (data as SupplierProfile | null) ?? null, error };
}
