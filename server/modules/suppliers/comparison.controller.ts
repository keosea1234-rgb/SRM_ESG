// GET /api/suppliers/compare?ids=uuid1,uuid2,...
// Side-by-side supplier metrics for comparison (max 5 IDs).

import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { supabase } from "../../db/supabaseClient";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import logger from "../../shared/logger";
import type { ServiceResult } from "./suppliers.service";

const MAX_COMPARE_IDS = 5;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length ? s : null;
}

export type SupplierCompareRow = {
  id: string;
  name: string;
  industry: string | null;
  status: string | null;
  esg: {
    overall: number | null;
    env: number | null;
    social: number | null;
    gov: number | null;
  };
  performance: {
    overall: number | null;
    quality: number | null;
    delivery: number | null;
    price: number | null;
    communication: number | null;
  };
  risk: {
    level: string | null;
    financial: number | null;
    operational: number | null;
    compliance: number | null;
    geopolitical: number | null;
    reputational: number | null;
  };
  contract_value: number | null;
};

export type SuppliersComparePayload = {
  suppliers: SupplierCompareRow[];
};

async function fetchOneSupplierCompare(supplierId: string): Promise<ServiceResult<SupplierCompareRow>> {
  try {
    const [sumRes, esgRes, perfRes, riskRes] = await Promise.all([
      supabase
        .from("v_supplier_summary")
        .select("id,name,industry,status,latest_performance_score,current_risk_level,total_value")
        .eq("id", supplierId)
        .maybeSingle(),
      supabase
        .from("srm_esg_assessments")
        .select("overall_esg_score, env_score, social_score, gov_score")
        .eq("supplier_id", supplierId)
        .eq("status", "approved")
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("srm_performance_evaluations")
        .select("quality_score, delivery_score, price_score, communication_score, overall_score")
        .eq("supplier_id", supplierId)
        .order("evaluation_period", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("srm_risk_assessments")
        .select(
          "financial_risk, operational_risk, compliance_risk, geopolitical_risk, reputational_risk, overall_risk_level"
        )
        .eq("supplier_id", supplierId)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (sumRes.error) {
      logger.error({ err: sumRes.error, supplierId }, "compare: v_supplier_summary query failed");
      return { ok: false, status: 500, error: sumRes.error.message };
    }
    if (esgRes.error) {
      logger.error({ err: esgRes.error, supplierId }, "compare: srm_esg_assessments query failed");
      return { ok: false, status: 500, error: esgRes.error.message };
    }
    if (perfRes.error) {
      logger.error({ err: perfRes.error, supplierId }, "compare: srm_performance_evaluations query failed");
      return { ok: false, status: 500, error: perfRes.error.message };
    }
    if (riskRes.error) {
      logger.error({ err: riskRes.error, supplierId }, "compare: srm_risk_assessments query failed");
      return { ok: false, status: 500, error: riskRes.error.message };
    }

    const s = sumRes.data;
    const e = esgRes.data;
    const p = perfRes.data;
    const r = riskRes.data;

    const row: SupplierCompareRow = {
      id: supplierId,
      name: str(s?.name) ?? "Unknown",
      industry: str(s?.industry),
      status: str(s?.status),
      esg: {
        overall: num(e?.overall_esg_score),
        env: num(e?.env_score),
        social: num(e?.social_score),
        gov: num(e?.gov_score),
      },
      performance: {
        overall: num(p?.overall_score),
        quality: num(p?.quality_score),
        delivery: num(p?.delivery_score),
        price: num(p?.price_score),
        communication: num(p?.communication_score),
      },
      risk: {
        level: r?.overall_risk_level != null ? String(r.overall_risk_level) : null,
        financial: num(r?.financial_risk),
        operational: num(r?.operational_risk),
        compliance: num(r?.compliance_risk),
        geopolitical: num(r?.geopolitical_risk),
        reputational: num(r?.reputational_risk),
      },
      contract_value: num(s?.total_value),
    };

    return { ok: true, data: row };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load supplier comparison";
    logger.error({ err, supplierId }, "fetchOneSupplierCompare failed");
    return { ok: false, status: 500, error: message };
  }
}

export async function compareSuppliersService(
  supplierIds: string[]
): Promise<ServiceResult<SuppliersComparePayload>> {
  if (supplierIds.length > MAX_COMPARE_IDS) {
    return { ok: false, status: 400, error: `Maximum ${MAX_COMPARE_IDS} supplier IDs allowed` };
  }

  const results = await Promise.all(supplierIds.map((id) => fetchOneSupplierCompare(id)));
  for (const r of results) {
    if (!r.ok) return r;
  }
  const suppliers = results.map((r) => (r as { ok: true; data: SupplierCompareRow }).data);

  return { ok: true, data: { suppliers } };
}

/** GET /api/suppliers/compare?ids=uuid1,uuid2,... */
export async function getComparisonHandler(req: AuthRequest, res: Response) {
  try {
    const raw = req.query.ids;
    const parts = Array.isArray(raw)
      ? raw.flatMap((r) => String(r).split(","))
      : String(raw ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const uniqueValid = [...new Set(parts.filter(isUuid))];

    if (uniqueValid.length > MAX_COMPARE_IDS) {
      return sendError(res, 400, `Maximum ${MAX_COMPARE_IDS} supplier IDs allowed`);
    }
    if (uniqueValid.length === 0) {
      return sendError(res, 400, "At least 2 supplier IDs required");
    }
    if (uniqueValid.length === 1) {
      return sendError(res, 400, "Select at least 2 suppliers to compare");
    }

    const result = await compareSuppliersService(uniqueValid);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    sendError(res, 500, message);
  }
}
