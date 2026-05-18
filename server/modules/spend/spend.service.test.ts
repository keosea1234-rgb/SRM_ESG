import { describe, expect, it } from "vitest";
import { buildSpendSummary, getDescendantIds } from "./spend.service";

const categories = [
  { id: "cat-1", name: "Logistics", level: 1, parent_id: null, sort_order: 0, is_active: true },
  { id: "cat-2", name: "Freight", level: 2, parent_id: "cat-1", sort_order: 0, is_active: true },
  { id: "cat-3", name: "Air Freight", level: 3, parent_id: "cat-2", sort_order: 0, is_active: true },
];

const regions = [
  { id: "reg-1", name: "Europe", level: 1, parent_id: null, sort_order: 0, is_active: true },
  { id: "reg-2", name: "Germany", level: 2, parent_id: "reg-1", sort_order: 0, is_active: true },
  { id: "reg-3", name: "Berlin", level: 3, parent_id: "reg-2", sort_order: 0, is_active: true },
];

const businessGroups = [
  { id: "bg-1", name: "Mobility", code: "MOB", is_active: true },
  { id: "bg-2", name: "Energy", code: "ENE", is_active: true },
];

describe("buildSpendSummary", () => {
  it("aggregates totals and hierarchy paths", () => {
    const result = buildSpendSummary({
      categories,
      regions,
      businessGroups,
      records: [
        {
          id: "sp-1",
          supplier_id: "sup-1",
          supplier_name: "AeroTrans",
          category_id: "cat-3",
          region_id: "reg-3",
          business_group_id: "bg-1",
          amount: 1200,
          currency: "USD",
          spend_date: "2026-05-01",
        },
        {
          id: "sp-2",
          supplier_id: "sup-1",
          supplier_name: "AeroTrans",
          category_id: "cat-3",
          region_id: "reg-3",
          business_group_id: "bg-2",
          amount: 800,
          currency: "USD",
          spend_date: "2026-05-02",
        },
      ],
    });

    expect(result.totals.totalSpend).toBe(2000);
    expect(result.totals.recordsCount).toBe(2);
    expect(result.totals.supplierCount).toBe(1);
    expect(result.categoryBreakdown[0].path).toBe("Logistics > Freight > Air Freight");
    expect(result.regionBreakdown[0].path).toBe("Europe > Germany > Berlin");
    expect(result.supplierBreakdown[0].primaryCategoryPath).toBe("Logistics > Freight > Air Freight");
    expect(result.supplierBreakdown[0].businessGroupCount).toBe(2);
    expect(result.filters.categories[0]).toMatchObject({
      name: "Logistics",
      path: "Logistics",
      level: 1,
      parentId: null,
    });
    expect(result.filters.categories[2]).toMatchObject({
      name: "Air Freight",
      path: "Logistics > Freight > Air Freight",
      level: 3,
      parentId: "cat-2",
      totalSpend: 2000,
      recordCount: 2,
    });
  });

  it("handles empty datasets", () => {
    const result = buildSpendSummary({
      categories,
      regions,
      businessGroups,
      records: [],
    });

    expect(result.totals.totalSpend).toBe(0);
    expect(result.categoryBreakdown).toHaveLength(0);
    expect(result.regionBreakdown).toHaveLength(0);
    expect(result.supplierBreakdown).toHaveLength(0);
    expect(result.businessGroupBreakdown).toHaveLength(0);
  });

  it("calculates enterprise spend KPIs and context safely", () => {
    const result = buildSpendSummary({
      categories,
      regions,
      businessGroups,
      supplierContext: [
        {
          supplier_id: "sup-1",
          current_risk_level: "critical",
          latest_performance_score: 7.5,
          esg_score: 42,
          active_contract_count: 1,
          active_contract_value: 400,
        },
        {
          supplier_id: "sup-2",
          current_risk_level: "low",
          latest_performance_score: null,
          esg_score: null,
          active_contract_count: 0,
          active_contract_value: 0,
        },
      ],
      records: [
        {
          id: "sp-1",
          supplier_id: "sup-1",
          supplier_name: "AeroTrans",
          category_id: "cat-3",
          region_id: "reg-3",
          business_group_id: "bg-1",
          amount: 1000,
          currency: "USD",
          spend_date: "2026-05-01",
        },
        {
          id: "sp-2",
          supplier_id: "sup-2",
          supplier_name: "BoxWorks",
          category_id: "cat-2",
          region_id: "reg-2",
          business_group_id: "bg-2",
          amount: 500,
          currency: "USD",
          spend_date: "2026-06-01",
        },
      ],
    });

    expect(result.kpis.managedSpend).toBe(1000);
    expect(result.kpis.unmanagedSpend).toBe(500);
    expect(result.kpis.highRiskSpend).toBe(1000);
    expect(result.kpis.esgLowSpend).toBe(1000);
    expect(result.kpis.contractCoveragePct).toBe(66.7);
    expect(result.trend).toHaveLength(2);
    expect(result.spendRows[0]).toMatchObject({ supplierName: "AeroTrans", isManaged: true });
    expect(result.supplierBreakdown[0]).toMatchObject({
      currentRiskLevel: "critical",
      esgScore: 42,
      activeContractCount: 1,
      isManaged: true,
      contractCoverageStatus: "partial",
      contractCoverageGap: 600,
      healthBand: "watch",
    });
    expect(result.contractCoverage.coverageGapSpend).toBe(1100);
    expect(result.contractCoverage.partiallyCoveredSupplierCount).toBe(1);
    expect(result.contractCoverage.suppliersWithCoverageGap).toHaveLength(2);
    expect(result.supplierHealthSummary.watchSupplierCount).toBe(2);
    const leakage = result.opportunities.find((item) => item.type === "contract_leakage");
    expect(leakage).toMatchObject({ affectedSupplierCount: 1, affectedRecordCount: 1 });
    expect(result.exportRows[0]).toMatchObject({
      spendId: "sp-1",
      managedStatus: "managed",
      riskLevel: "critical",
    });
    expect(result.analystWorkspace.some((item) => item.quickFilters.includes("coverage_gap"))).toBe(true);
    expect(result.dataQualityWarnings).toContain(
      "Filtered slice has fewer than 10 spend records; tail-spend and consolidation signals are intentionally conservative."
    );
  });

  it("expands a selected hierarchy node to its descendants", () => {
    expect(getDescendantIds(categories, "cat-1")).toEqual(["cat-1", "cat-2", "cat-3"]);
    expect(getDescendantIds(categories, "cat-2")).toEqual(["cat-2", "cat-3"]);
    expect(getDescendantIds(categories, "missing")).toEqual(["missing"]);
  });
});
