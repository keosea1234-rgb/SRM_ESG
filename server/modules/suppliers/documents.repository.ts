import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../db/supabaseClient";

type RepositoryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

export interface SupplierDocument {
  id: string;
  supplier_id: string;
  status: "pending" | "approved" | "rejected" | string;
  approved_by?: string | null;
  approved_at?: string | null;
  [key: string]: unknown;
}

// Gets all documents for a supplier id.
export async function getDocumentsBySupplierId(
  supplierId: string
): Promise<RepositoryResult<SupplierDocument[]>> {
  const { data, error } = await supabase
    .from("srm_supplier_documents")
    .select("*")
    .eq("supplier_id", supplierId);

  return { data: (data as SupplierDocument[] | null) ?? [], error };
}

// Uploads a binary file to Supabase Storage for supplier documents.
export async function uploadDocumentFile(params: {
  supplierId: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<{ path: string | null; error: Error | null }> {
  const safeBase = (() => {
    // 1. Take only the final filename component — strip any directory segments
    const basename = params.fileName.replace(/[/\\]/g, "_");
    // 2. Allow only safe characters
    const cleaned = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
    // 3. Collapse any remaining dot-dot sequences
    const noDotDot = cleaned.replace(/\.{2,}/g, "_");
    // 4. Strip leading dots (hidden file names)
    const noLeadingDot = noDotDot.replace(/^\.+/, "");
    return noLeadingDot || "upload";
  })();
  const storagePath = `${params.supplierId}/${Date.now()}-${safeBase}`;

  const { data, error } = await supabase.storage.from("supplier-documents").upload(storagePath, params.fileBuffer, {
    contentType: params.mimeType,
    upsert: false,
  });

  if (error) {
    return { path: null, error: new Error(error.message) };
  }

  const pathReturned = typeof data?.path === "string" ? data.path : storagePath;
  return { path: pathReturned, error: null };
}

// Creates one supplier document for a supplier id.
export async function createDocument(
  supplierId: string,
  payload: Record<string, unknown>
): Promise<RepositoryResult<SupplierDocument>> {
  const { data, error } = await supabase
    .from("srm_supplier_documents")
    .insert({ ...payload, supplier_id: supplierId })
    .select()
    .single();

  return { data: (data as SupplierDocument | null) ?? null, error };
}

// Fetches one document by id scoped to a supplier id.
export async function getDocumentBySupplierAndId(
  supplierId: string,
  documentId: string
): Promise<RepositoryResult<SupplierDocument | null>> {
  const { data, error } = await supabase
    .from("srm_supplier_documents")
    .select("*")
    .eq("id", documentId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  return { data: (data as SupplierDocument | null) ?? null, error };
}

// Deletes one document row for a supplier id and document id.
export async function deleteDocumentRow(
  supplierId: string,
  documentId: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("srm_supplier_documents")
    .delete()
    .eq("id", documentId)
    .eq("supplier_id", supplierId);

  return { error };
}

// Removes an object from the supplier-documents storage bucket by path.
export async function removeDocumentFileFromStorage(
  filePath: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from("supplier-documents").remove([filePath]);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

// Updates approval status metadata for a document id.
export async function updateDocumentStatus(
  documentId: string,
  status: "approved" | "rejected",
  approvedBy: string
): Promise<RepositoryResult<SupplierDocument>> {
  const { data, error } = await supabase
    .from("srm_supplier_documents")
    .update({
      status,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select()
    .single();

  return { data: (data as SupplierDocument | null) ?? null, error };
}
