// server/modules/suppliers/suppliers.routes.ts
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole, requireSupplierOwnership } from "../../middleware/requireRole.js";
import { validateFileMagicBytes } from "../../middleware/upload";
import { writeLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import {
  createSupplierContactHandler,
  createSupplierHandler,
  getAllSuppliersHandler,
  getSupplierSegmentsHandler,
  getSupplierByIdHandler,
  getSupplierContactsHandler,
  getSupplierContractsHandler,
  getHealthNarrativeHandler,
  inviteSupplierHandler,
  updateSupplierHandler,
} from "./suppliers.controller";
import { getProfileHandler, upsertProfileHandler } from "./profile.controller";
import {
  approveDocumentHandler,
  deleteDocumentHandler,
  listDocumentsHandler,
  rejectDocumentHandler,
  uploadDocumentHandler,
  uploadSupplierDocumentMiddleware,
} from "./documents.controller";
import {
  approveSupplierHandler,
  rejectSupplierHandler,
  submitForReviewHandler,
} from "./approval.controller";
import { createSupplierSchema, updateSupplierSchema, createContactSchema, inviteSupplierSchema, upsertProfileSchema } from "./suppliers.schema";
import {
  exportSuppliersCSVHandler,
} from "./export.controller";
import { getComparisonHandler } from "./comparison.controller";

const suppliersRouter = Router();

suppliersRouter.use(requireAuth);

// ── Export (before :id routes to avoid param collision) ──────────────────────
suppliersRouter.get("/suppliers/export", exportSuppliersCSVHandler);

// ── List & Create ─────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers", getAllSuppliersHandler);
suppliersRouter.post(
  "/suppliers",
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  validate(createSupplierSchema),
  createSupplierHandler
);

// ── Compare (before :id routes to avoid param collision) ─────────────────────
suppliersRouter.get("/suppliers/compare", getComparisonHandler);
suppliersRouter.get("/suppliers/segments", getSupplierSegmentsHandler);

// ── Single ────────────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers/:id", getSupplierByIdHandler);
suppliersRouter.get("/suppliers/:id/health-narrative", getHealthNarrativeHandler);
suppliersRouter.patch(
  "/suppliers/:id",
  requireAuth,
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  validate(updateSupplierSchema),
  updateSupplierHandler
);

// ── Contacts ──────────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers/:id/contacts", getSupplierContactsHandler);
suppliersRouter.post("/suppliers/:id/contacts", requireRole("admin", "procurement_manager"), writeLimiter, validate(createContactSchema), createSupplierContactHandler);

// ── Profile ───────────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers/:id/profile", getProfileHandler);
suppliersRouter.put(
  "/suppliers/:id/profile",
  requireRole("admin", "procurement_manager", "supplier"),
  validate(upsertProfileSchema),
  upsertProfileHandler
);
suppliersRouter.patch(
  "/suppliers/:id/profile",
  requireRole("admin", "procurement_manager", "supplier"),
  validate(upsertProfileSchema),
  upsertProfileHandler
);

// ── Contracts ─────────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers/:id/contracts", getSupplierContractsHandler);

// ── Documents ─────────────────────────────────────────────────────────────────
suppliersRouter.get("/suppliers/:id/documents", requireSupplierOwnership, listDocumentsHandler);
suppliersRouter.post(
  "/suppliers/:id/documents",
  requireRole("admin", "procurement_manager", "supplier"),
  requireSupplierOwnership,
  writeLimiter,
  uploadSupplierDocumentMiddleware,
  validateFileMagicBytes,
  uploadDocumentHandler
);
suppliersRouter.put("/suppliers/:id/documents/:documentId/approve", requireRole("admin", "procurement_manager"), writeLimiter, approveDocumentHandler);
suppliersRouter.put("/suppliers/:id/documents/:documentId/reject", requireRole("admin", "procurement_manager"), writeLimiter, rejectDocumentHandler);
suppliersRouter.delete(
  "/suppliers/:id/documents/:documentId",
  requireRole("admin", "procurement_manager", "supplier"),
  requireSupplierOwnership,
  deleteDocumentHandler
);

// ── Approval & Invite ─────────────────────────────────────────────────────────
suppliersRouter.post("/suppliers/:id/approve", requireRole("admin", "procurement_manager"), writeLimiter, approveSupplierHandler);
suppliersRouter.post("/suppliers/:id/reject", requireRole("admin", "procurement_manager"), writeLimiter, rejectSupplierHandler);
suppliersRouter.post(
  "/suppliers/:id/invite",
  requireRole("admin", "procurement_manager"),
  writeLimiter,
  validate(inviteSupplierSchema),
  inviteSupplierHandler
);
suppliersRouter.post(
  "/suppliers/:id/submit",
  requireRole("admin", "procurement_manager", "supplier"),
  requireSupplierOwnership,
  submitForReviewHandler
);

export default suppliersRouter;
