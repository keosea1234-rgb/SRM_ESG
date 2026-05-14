import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { uploadSupplierDocumentIfMultipart } from "../../middleware/upload";
import {
  approveDocument,
  deleteDocument,
  listDocuments,
  rejectDocument,
  uploadDocument,
} from "./documents.service";

// Multer middleware for POST /suppliers/:id/documents (multipart field "file" when using FormData).
export const uploadSupplierDocumentMiddleware = uploadSupplierDocumentIfMultipart;

// Handles listing all documents for a supplier id.
export async function listDocumentsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await listDocuments(req.params.id as string);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

// Handles uploading one document for a supplier id.
export async function uploadDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const body = {
      title: req.body?.title ?? req.body?.document_name ?? "Untitled",
      status: "pending",
    };

    const result = await uploadDocument(
      req.params.id as string,
      body,
      req.userId,
      req.file
    );
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data, 201);
  } catch (err) {
    next(err);
  }
}

// Handles approving one supplier document.
export async function approveDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return sendError(res, 401, "Missing authenticated user");
    }

    const result = await approveDocument(req.params.documentId as string, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

// Handles rejecting one supplier document.
export async function rejectDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return sendError(res, 401, "Missing authenticated user");
    }

    const result = await rejectDocument(req.params.documentId as string, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    next(err);
  }
}

// Handles deleting one pending supplier document for a supplier id.
export async function deleteDocumentHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await deleteDocument(
      req.params.id as string,
      req.params.documentId as string
    );
    if (!result.ok) return sendError(res, result.status, result.error);
    return sendSuccess(res, null, 204);
  } catch (err) {
    next(err);
  }
}
