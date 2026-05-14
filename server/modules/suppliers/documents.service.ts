import type { Express } from "express";
import {
  createDocument,
  deleteDocumentRow,
  getDocumentBySupplierAndId,
  getDocumentsBySupplierId,
  removeDocumentFileFromStorage,
  SupplierDocument,
  updateDocumentStatus,
  uploadDocumentFile,
} from "./documents.repository";

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

// Lists all supplier documents for a supplier id.
export async function listDocuments(
  supplierId: string
): Promise<ServiceResult<SupplierDocument[]>> {
  const { data, error } = await getDocumentsBySupplierId(supplierId);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, data: data ?? [] };
}

// Uploads a new supplier document using the provided payload (optional binary via multer file).
export async function uploadDocument(
  supplierId: string,
  payload: Record<string, unknown>,
  userId: string | undefined,
  file?: Express.Multer.File
): Promise<ServiceResult<SupplierDocument>> {
  let filePath: string | null | undefined;

  if (file) {
    const { path, error: storageError } = await uploadDocumentFile({
      supplierId,
      fileName: file.originalname || "upload",
      fileBuffer: file.buffer,
      mimeType: file.mimetype || "application/octet-stream",
    });

    if (storageError || !path) {
      return {
        ok: false,
        status: 400,
        error: storageError?.message ?? "Failed to upload file",
      };
    }

    filePath = path;
  }

  const row: Record<string, unknown> = {
    document_name: payload.title ?? payload.document_name ?? "Untitled",
    status: payload.status ?? "pending",
    uploaded_by: userId ?? null,
  };

  if (filePath) {
    row.file_path = filePath;
  }

  const { data, error } = await createDocument(supplierId, row);
  if (error || !data) {
    return { ok: false, status: 400, error: error?.message ?? "Failed to upload document" };
  }
  return { ok: true, data };
}

// Approves a supplier document for a document id.
export async function approveDocument(
  documentId: string,
  userId: string
): Promise<ServiceResult<SupplierDocument>> {
  const { data, error } = await updateDocumentStatus(documentId, "approved", userId);
  if (error || !data) {
    return { ok: false, status: 400, error: error?.message ?? "Failed to approve document" };
  }
  return { ok: true, data };
}

// Rejects a supplier document for a document id.
export async function rejectDocument(
  documentId: string,
  userId: string
): Promise<ServiceResult<SupplierDocument>> {
  const { data, error } = await updateDocumentStatus(documentId, "rejected", userId);
  if (error || !data) {
    return { ok: false, status: 400, error: error?.message ?? "Failed to reject document" };
  }
  return { ok: true, data };
}

// Deletes a pending supplier document and removes its storage object when present.
export async function deleteDocument(
  supplierId: string,
  documentId: string
): Promise<ServiceResult<null>> {
  const { data: doc, error: fetchError } = await getDocumentBySupplierAndId(supplierId, documentId);
  if (fetchError) {
    return { ok: false, status: 500, error: fetchError.message };
  }
  if (!doc) {
    return { ok: false, status: 404, error: "Document not found" };
  }
  if (doc.status !== "pending") {
    return { ok: false, status: 400, error: "Only pending documents can be deleted" };
  }

  const filePath = typeof doc.file_path === "string" ? doc.file_path : null;
  if (filePath) {
    const { error: storageError } = await removeDocumentFileFromStorage(filePath);
    if (storageError) {
      return { ok: false, status: 400, error: storageError.message };
    }
  }

  const { error: deleteError } = await deleteDocumentRow(supplierId, documentId);
  if (deleteError) {
    return { ok: false, status: 400, error: deleteError.message };
  }
  return { ok: true, data: null };
}
