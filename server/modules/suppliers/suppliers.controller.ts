// server/modules/suppliers/suppliers.controller.ts
// Route handlers for the suppliers module.
// Thin layer: parse request → call service → send response.

import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { supabase } from "../../db/supabaseClient";
import { parsePagination } from "../../shared/pagination";
import { parseSupplierFilters } from '../../shared/filters';
import {
  getSuppliersService,
  getSupplierById,
  getSupplierContacts,
  createSupplierContact,
  getSupplierContracts,
  createSupplier,
  updateSupplier,
  inviteSupplier,
} from "./suppliers.service";
import { generateHealthNarrative } from "./narrative.service";
import { buildSegmentMap, type SupplierSummaryRowForSegmentation } from "./segmentation.service";

// ── LIST ──────────────────────────────────────────────────────────────────────

// GET /api/suppliers?page=1&limit=20
export async function getAllSuppliersHandler(req: AuthRequest, res: Response) {
  try {
    const pagination = parsePagination(req.query);
    const filters = parseSupplierFilters(req.query);
    const result = await getSuppliersService(pagination, filters);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? 'Internal server error');
  }
}

// ── SINGLE ────────────────────────────────────────────────────────────────────

// GET /api/suppliers/:id
export async function getSupplierByIdHandler(req: AuthRequest, res: Response) {
  try {
    const result = await getSupplierById(String(req.params.id));
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// ── CREATE ────────────────────────────────────────────────────────────────────

// POST /api/suppliers
export async function createSupplierHandler(req: AuthRequest, res: Response) {
  try {
    const result = await createSupplier(req.body, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data, 201);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

// PATCH /api/suppliers/:id
export async function updateSupplierHandler(req: AuthRequest, res: Response) {
  try {
    const result = await updateSupplier(String(req.params.id), req.body, req.userId);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────

// GET /api/suppliers/:id/contacts
export async function getSupplierContactsHandler(req: AuthRequest, res: Response) {
  try {
    const result = await getSupplierContacts(String(req.params.id));
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// POST /api/suppliers/:id/contacts
export async function createSupplierContactHandler(req: AuthRequest, res: Response) {
  try {
    const result = await createSupplierContact(String(req.params.id), req.body);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data, 201);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// ── CONTRACTS ─────────────────────────────────────────────────────────────────

// GET /api/suppliers/:id/contracts
export async function getSupplierContractsHandler(req: AuthRequest, res: Response) {
  try {
    const result = await getSupplierContracts(String(req.params.id));
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// ── INVITE ────────────────────────────────────────────────────────────────────

// POST /api/suppliers/:id/invite
export async function inviteSupplierHandler(req: AuthRequest, res: Response) {
  try {
    const result = await inviteSupplier({
      supplierId: String(req.params.id),
      email: req.body.email,
      userId: req.userId,
    });
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// GET /api/suppliers/:id/health-narrative
export async function getHealthNarrativeHandler(req: AuthRequest, res: Response) {
  try {
    const narrative = await generateHealthNarrative(String(req.params.id));
    return sendSuccess(res, narrative);
  } catch (err: any) {
    return sendError(res, 500, err?.message ?? "Internal server error");
  }
}

// GET /api/suppliers/segments
export async function getSupplierSegmentsHandler(_req: AuthRequest, res: Response) {
  try {
    const [{ data: suppliers, error: suppliersError }, { data: contracts, error: contractsError }] = await Promise.all([
      supabase
        .from("v_supplier_summary")
        .select("id, latest_performance_score, current_risk_level, contract_count"),
      supabase
        .from("contracts")
        .select("supplier_id, category"),
    ]);

    if (suppliersError) return sendError(res, 500, suppliersError.message);
    if (contractsError) return sendError(res, 500, contractsError.message);

    const supplierIds = (suppliers ?? [])
      .map((s) => s.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: esgRows, error: esgError } = await supabase
      .from("srm_esg_assessments")
      .select("supplier_id, assessment_date, overall_esg_score")
      .in("supplier_id", supplierIds)
      .eq("status", "approved")
      .order("assessment_date", { ascending: true });
    if (esgError) return sendError(res, 500, esgError.message);

    const bySupplierEsg = new Map<string, { latest: number | null; delta90: number | null }>();
    for (const id of supplierIds) {
      const rows = (esgRows ?? []).filter((r) => r.supplier_id === id);
      const latest = rows.length > 0 ? (rows[rows.length - 1].overall_esg_score ?? null) : null;
      const recent = rows.filter((r) => (r.assessment_date ?? "") >= ninetyDaysAgo);
      const delta90 =
        recent.length >= 2
          ? (recent[recent.length - 1].overall_esg_score ?? 0) - (recent[0].overall_esg_score ?? 0)
          : null;
      bySupplierEsg.set(id, { latest, delta90 });
    }

    const categorySuppliers = new Map<string, Set<string>>();
    for (const c of contracts ?? []) {
      const category = typeof c.category === "string" ? c.category : null;
      const supplierId = typeof c.supplier_id === "string" ? c.supplier_id : null;
      if (!category || !supplierId) continue;
      if (!categorySuppliers.has(category)) categorySuppliers.set(category, new Set<string>());
      categorySuppliers.get(category)?.add(supplierId);
    }
    const singleSourceIds = new Set<string>();
    for (const suppliersInCategory of categorySuppliers.values()) {
      if (suppliersInCategory.size === 1) {
        const [supplierId] = [...suppliersInCategory];
        if (supplierId) singleSourceIds.add(supplierId);
      }
    }

    const rows: SupplierSummaryRowForSegmentation[] = (suppliers ?? [])
      .filter((s) => typeof s.id === "string" && s.id.length > 0)
      .map((s) => {
        const esgInfo = bySupplierEsg.get(s.id as string);
        return {
          id: s.id as string,
          latest_performance_score: s.latest_performance_score ?? null,
          current_risk_level: s.current_risk_level ?? null,
          contract_count: s.contract_count ?? null,
          overall_esg_score: esgInfo?.latest ?? null,
          esg_trend_delta_90d: esgInfo?.delta90 ?? null,
          overall_score:
            s.latest_performance_score != null
              ? s.latest_performance_score > 10
                ? s.latest_performance_score
                : s.latest_performance_score * 10
              : null,
          is_single_source: singleSourceIds.has(s.id as string),
        };
      });

    return sendSuccess(res, buildSegmentMap(rows));
  } catch (err: any) {
    return sendError(res, 500, err?.message ?? "Internal server error");
  }
}