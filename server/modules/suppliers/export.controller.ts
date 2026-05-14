// server/modules/suppliers/export.controller.ts
// GET /api/suppliers/export?format=csv&status=active&search=acme
// Streams CSV directly — no temp file, no memory buffer for large datasets.

import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError } from "../../middleware/errorHandler";
import { parseSupplierFilters } from "../../shared/filters";
import { supabase } from "../../db/supabaseClient";

function escapeCSV(val: unknown): string {
  if (val == null) return "";
  let str = String(val);
  // Neutralize CSV formula injection (CWE-1236)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSVRow(cols: unknown[]): string {
  return cols.map(escapeCSV).join(",");
}

export async function exportSuppliersCSVHandler(
  req: AuthRequest,
  res: Response
) {
  try {
    const filters = parseSupplierFilters(req.query as Record<string, unknown>);

    let query = supabase
      .from("v_supplier_summary")
      .select(
        "name, status, industry, city, country, latest_performance_score, current_risk_level, contract_count, created_at"
      )
      .order("name", { ascending: true });

    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) {
      return sendError(res, 500, error.message);
    }

    const rows = data ?? [];

    // Headers
    const header = toCSVRow([
      "Name",
      "Status",
      "Industry",
      "City",
      "Country",
      "Performance Score",
      "Risk Level",
      "Contract Count",
      "Added",
    ]);

    const lines = rows.map((r) =>
      toCSVRow([
        r.name,
        r.status,
        r.industry,
        r.city,
        r.country,
        r.latest_performance_score,
        r.current_risk_level,
        r.contract_count,
        r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "",
      ])
    );

    const csv = [header, ...lines].join("\r\n");

    const filename = `suppliers_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    // BOM for Excel UTF-8 compatibility
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Export failed");
  }
}

export async function exportESGLeaderboardCSVHandler(
  req: AuthRequest,
  res: Response
) {
  try {
    const { data, error } = await supabase
      .from("srm_esg_assessments")
      .select(
        `
        period,
        overall_esg_score,
        env_score,
        social_score,
        gov_score,
        env_certifications,
        social_certifications,
        gov_certifications,
        renewable_energy_pct,
        waste_recycling_pct,
        carbon_footprint_tons,
        women_in_mgmt_pct,
        living_wage_compliant,
        anti_corruption_policy,
        independent_audit,
        gdpr_compliant,
        assessment_date,
        srm_suppliers!inner(name)
      `
      )
      .eq("status", "approved")
      .order("overall_esg_score", { ascending: false });

    if (error) return sendError(res, 500, error.message);

    const rows = data ?? [];

    const header = toCSVRow([
      "Supplier",
      "Period",
      "ESG Score",
      "E Score",
      "S Score",
      "G Score",
      "Renewable Energy %",
      "Waste Recycling %",
      "Carbon Footprint (t)",
      "Women in Mgmt %",
      "Living Wage",
      "Anti-Corruption",
      "Independent Audit",
      "GDPR Compliant",
      "Env Certifications",
      "Social Certifications",
      "Gov Certifications",
      "Assessment Date",
    ]);

    const lines = rows.map((r) =>
      toCSVRow([
        (r.srm_suppliers as any)?.name ?? "",
        r.period,
        r.overall_esg_score,
        r.env_score,
        r.social_score,
        r.gov_score,
        r.renewable_energy_pct,
        r.waste_recycling_pct,
        r.carbon_footprint_tons,
        r.women_in_mgmt_pct,
        r.living_wage_compliant == null ? "" : r.living_wage_compliant ? "Yes" : "No",
        r.anti_corruption_policy == null ? "" : r.anti_corruption_policy ? "Yes" : "No",
        r.independent_audit == null ? "" : r.independent_audit ? "Yes" : "No",
        r.gdpr_compliant == null ? "" : r.gdpr_compliant ? "Yes" : "No",
        (r.env_certifications ?? []).join("; "),
        (r.social_certifications ?? []).join("; "),
        (r.gov_certifications ?? []).join("; "),
        r.assessment_date,
      ])
    );

    const csv = [header, ...lines].join("\r\n");
    const filename = `esg_leaderboard_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Export failed");
  }
}
