import {
  listSpendBusinessGroups,
  listSpendCategories,
  listSpendRecords,
  listSpendRegions,
  listSpendSupplierContext,
  type SpendBusinessGroupRow,
  type SpendDimensionRow,
  type SpendRecordRow,
  type SpendSupplierContextRow,
} from "./spend.repository";
import type { SpendSummaryFilters } from "./spend.schema";

type ServiceSuccess<T> = { ok: true; data: T };
type ServiceFailure = { ok: false; status: number; error: string };
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export interface SpendFilterOption {
  value: string;
  label: string;
  name: string;
  path?: string;
  level?: number;
  parentId?: string | null;
  totalSpend?: number;
  recordCount?: number;
}

export interface SpendSummaryResponse {
  totals: {
    totalSpend: number;
    recordsCount: number;
    supplierCount: number;
    categoryCount: number;
    regionCount: number;
    businessGroupCount: number;
    currencies: string[];
  };
  kpis: SpendKpis;
  filters: {
    categories: SpendFilterOption[];
    regions: SpendFilterOption[];
    suppliers: SpendFilterOption[];
    businessGroups: SpendFilterOption[];
  };
  categoryBreakdown: SpendSummaryNode[];
  regionBreakdown: SpendSummaryNode[];
  supplierBreakdown: SpendSupplierBreakdown[];
  businessGroupBreakdown: SpendBusinessGroupBreakdown[];
  trend: SpendTrendPoint[];
  spendRows: SpendDetailRow[];
  supplierRiskOverlay: SpendSupplierBreakdown[];
  contractCoverage: SpendContractCoverage;
  supplierHealthSummary: SpendSupplierHealthSummary;
  opportunities: SpendOpportunity[];
  analystWorkspace: SpendAnalystGroup[];
  exportRows: SpendExportRow[];
  dataQualityWarnings: string[];
}

export interface SpendKpis {
  totalSpend: number;
  managedSpend: number;
  managedSpendPct: number;
  unmanagedSpend: number;
  contractCoveragePct: number;
  highRiskSpend: number;
  criticalSupplierSpend: number;
  esgLowSpend: number;
  topSupplierConcentrationPct: number;
  riskAdjustedSpend: number;
}

export interface SpendSummaryNode {
  id: string;
  name: string;
  path: string;
  level: number;
  parentId: string | null;
  totalSpend: number;
  recordCount: number;
}

export interface SpendSupplierBreakdown {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  recordCount: number;
  primaryCategoryPath: string | null;
  businessGroupCount: number;
  currentRiskLevel: string | null;
  latestPerformanceScore: number | null;
  esgScore: number | null;
  activeContractCount: number;
  activeContractValue: number;
  isManaged: boolean;
  contractCoverageStatus: "covered" | "partial" | "uncovered";
  contractCoverageGap: number;
  riskAdjustedSpend: number;
  healthScore: number | null;
  healthBand: "strong" | "watch" | "at_risk" | "unknown";
  contextCompleteness: number;
}

export interface SpendBusinessGroupBreakdown {
  id: string;
  name: string;
  totalSpend: number;
  recordCount: number;
}

export interface SpendTrendPoint {
  period: string;
  totalSpend: number;
  recordCount: number;
}

export interface SpendDetailRow {
  id: string;
  supplierId: string;
  supplierName: string;
  categoryPath: string | null;
  regionPath: string | null;
  businessGroupName: string | null;
  amount: number;
  currency: string;
  spendDate: string;
  currentRiskLevel: string | null;
  latestPerformanceScore: number | null;
  esgScore: number | null;
  isManaged: boolean;
}

export interface SpendContractCoverage {
  managedSpend: number;
  unmanagedSpend: number;
  coverageGapSpend: number;
  managedSupplierCount: number;
  partiallyCoveredSupplierCount: number;
  unmanagedSupplierCount: number;
  suppliersWithoutActiveContract: SpendSupplierBreakdown[];
  suppliersWithCoverageGap: SpendSupplierBreakdown[];
}

export interface SpendSupplierHealthSummary {
  strongSupplierCount: number;
  watchSupplierCount: number;
  atRiskSupplierCount: number;
  unknownSupplierCount: number;
  avgHealthScore: number | null;
}

export interface SpendOpportunity {
  id: string;
  type: "contract_leakage" | "supplier_consolidation" | "tail_spend" | "high_risk_spend" | "category_concentration";
  title: string;
  impact: number;
  confidence: "high" | "medium" | "low";
  affectedSupplierCount: number;
  affectedRecordCount: number;
  reason: string;
  recommendedAction: string;
}

export interface SpendAnalystGroup {
  id: string;
  groupBy: "category" | "supplier" | "region" | "businessGroup";
  label: string;
  totalSpend: number;
  recordCount: number;
  supplierCount: number;
  managedSpend: number;
  unmanagedSpend: number;
  highRiskSpend: number;
  coverageGapSpend: number;
  riskSupplierCount: number;
  opportunityImpact: number;
  quickFilters: Array<"high_risk" | "unmanaged" | "tail_spend" | "top_supplier" | "coverage_gap">;
}

export interface SpendExportRow {
  spendId: string;
  spendDate: string;
  supplierId: string;
  supplierName: string;
  categoryPath: string | null;
  regionPath: string | null;
  businessGroupName: string | null;
  amount: number;
  currency: string;
  managedStatus: "managed" | "unmanaged";
  riskLevel: string | null;
  performanceScore: number | null;
  esgScore: number | null;
}

function buildPath(map: Map<string, SpendDimensionRow>, id: string): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = id;

  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const node = map.get(cursor);
    if (!node) break;
    parts.unshift(node.name);
    cursor = node.parent_id;
  }

  return parts.join(" > ");
}

export function getDescendantIds(dimensions: SpendDimensionRow[], selectedId: string): string[] {
  const childrenByParent = new Map<string, SpendDimensionRow[]>();

  for (const item of dimensions) {
    if (!item.parent_id) continue;
    const siblings = childrenByParent.get(item.parent_id) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parent_id, siblings);
  }

  const ids: string[] = [];
  const queue = [selectedId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);

    for (const child of childrenByParent.get(id) ?? []) {
      queue.push(child.id);
    }
  }

  return ids;
}

function getDescendantIdsForSelection(dimensions: SpendDimensionRow[], selectedIds?: string[]): string[] | undefined {
  if (!selectedIds?.length) return undefined;
  return Array.from(new Set(selectedIds.flatMap((id) => getDescendantIds(dimensions, id))));
}

function sortBySpendDesc<T extends { totalSpend: number; name?: string; supplierName?: string; path?: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend;
    const aLabel = a.name ?? a.supplierName ?? a.path ?? "";
    const bLabel = b.name ?? b.supplierName ?? b.path ?? "";
    return aLabel.localeCompare(bLabel);
  });
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function riskWeight(level: string | null): number {
  const key = level?.toLowerCase();
  if (key === "critical") return 1;
  if (key === "high") return 0.7;
  if (key === "medium") return 0.35;
  if (key === "low") return 0.1;
  return 0.25;
}

function isHighRisk(level: string | null): boolean {
  const key = level?.toLowerCase();
  return key === "high" || key === "critical";
}

function riskScore(level: string | null): number | null {
  const key = level?.toLowerCase();
  if (key === "critical") return 0;
  if (key === "high") return 35;
  if (key === "medium") return 65;
  if (key === "low") return 90;
  return null;
}

function calculateHealth(ctx: SpendSupplierContextRow): {
  healthScore: number | null;
  healthBand: SpendSupplierBreakdown["healthBand"];
  contextCompleteness: number;
} {
  const signals = [
    riskScore(ctx.current_risk_level),
    ctx.latest_performance_score == null ? null : Math.max(0, Math.min(100, ctx.latest_performance_score * 10)),
    ctx.esg_score == null ? null : Math.max(0, Math.min(100, ctx.esg_score)),
    ctx.active_contract_count > 0 ? 90 : 25,
  ];
  const present = signals.filter((value): value is number => value != null);
  const contextCompleteness = roundPct((present.length / signals.length) * 100);
  if (present.length === 0) {
    return { healthScore: null, healthBand: "unknown", contextCompleteness };
  }

  const healthScore = roundPct(present.reduce((sum, value) => sum + value, 0) / present.length);
  const healthBand = healthScore >= 75 ? "strong" : healthScore >= 50 ? "watch" : "at_risk";
  return { healthScore, healthBand, contextCompleteness };
}

function contractCoverageStatus(totalSpend: number, activeContractValue: number, activeContractCount: number): {
  contractCoverageStatus: SpendSupplierBreakdown["contractCoverageStatus"];
  contractCoverageGap: number;
} {
  if (activeContractCount === 0) {
    return { contractCoverageStatus: "uncovered", contractCoverageGap: roundMoney(totalSpend) };
  }
  const gap = Math.max(totalSpend - activeContractValue, 0);
  return {
    contractCoverageStatus: gap > 0 ? "partial" : "covered",
    contractCoverageGap: roundMoney(gap),
  };
}

function contextForSupplier(
  contextMap: Map<string, SpendSupplierContextRow>,
  supplierId: string
): SpendSupplierContextRow {
  return (
    contextMap.get(supplierId) ?? {
      supplier_id: supplierId,
      current_risk_level: null,
      latest_performance_score: null,
      esg_score: null,
      active_contract_count: 0,
      active_contract_value: 0,
    }
  );
}

function buildDimensionFilterOptions(
  dimensions: SpendDimensionRow[],
  dimensionMap: Map<string, SpendDimensionRow>,
  spendById: Map<string, { totalSpend: number; recordCount: number }>
): SpendFilterOption[] {
  return dimensions.map((item) => {
    const spend = spendById.get(item.id);
    const path = buildPath(dimensionMap, item.id);

    return {
      value: item.id,
      label: path,
      name: item.name,
      path,
      level: item.level,
      parentId: item.parent_id,
      totalSpend: roundMoney(spend?.totalSpend ?? 0),
      recordCount: spend?.recordCount ?? 0,
    };
  });
}

function addAnalystGroup(
  map: Map<string, SpendAnalystGroup & { supplierIds: Set<string>; riskSupplierIds: Set<string> }>,
  groupBy: SpendAnalystGroup["groupBy"],
  id: string,
  label: string,
  record: SpendRecordRow,
  ctx: SpendSupplierContextRow
) {
  const key = `${groupBy}:${id}`;
  const existing =
    map.get(key) ??
    {
      id,
      groupBy,
      label,
      totalSpend: 0,
      recordCount: 0,
      supplierCount: 0,
      managedSpend: 0,
      unmanagedSpend: 0,
      highRiskSpend: 0,
      coverageGapSpend: 0,
      riskSupplierCount: 0,
      opportunityImpact: 0,
      quickFilters: [],
      supplierIds: new Set<string>(),
      riskSupplierIds: new Set<string>(),
    };

  existing.totalSpend += record.amount;
  existing.recordCount += 1;
  existing.supplierIds.add(record.supplier_id);
  if (ctx.active_contract_count > 0) existing.managedSpend += record.amount;
  else existing.unmanagedSpend += record.amount;
  if (isHighRisk(ctx.current_risk_level)) {
    existing.highRiskSpend += record.amount;
    existing.riskSupplierIds.add(record.supplier_id);
  }
  existing.opportunityImpact = existing.unmanagedSpend + existing.highRiskSpend;
  existing.supplierCount = existing.supplierIds.size;
  existing.riskSupplierCount = existing.riskSupplierIds.size;
  map.set(key, existing);
}

function buildAnalystWorkspace(input: {
  records: SpendRecordRow[];
  supplierBreakdown: SpendSupplierBreakdown[];
  categoryMap: Map<string, SpendDimensionRow>;
  regionMap: Map<string, SpendDimensionRow>;
  businessGroupMap: Map<string, SpendBusinessGroupRow>;
  contextMap: Map<string, SpendSupplierContextRow>;
}): SpendAnalystGroup[] {
  const map = new Map<string, SpendAnalystGroup & { supplierIds: Set<string>; riskSupplierIds: Set<string> }>();
  const supplierNames = new Map(input.supplierBreakdown.map((item) => [item.supplierId, item.supplierName]));

  for (const record of input.records) {
    const ctx = contextForSupplier(input.contextMap, record.supplier_id);
    addAnalystGroup(
      map,
      "category",
      record.category_id,
      input.categoryMap.has(record.category_id) ? buildPath(input.categoryMap, record.category_id) : "Unmapped category",
      record,
      ctx
    );
    addAnalystGroup(
      map,
      "region",
      record.region_id,
      input.regionMap.has(record.region_id) ? buildPath(input.regionMap, record.region_id) : "Unmapped region",
      record,
      ctx
    );
    addAnalystGroup(
      map,
      "supplier",
      record.supplier_id,
      supplierNames.get(record.supplier_id) ?? record.supplier_name ?? "Unknown supplier",
      record,
      ctx
    );
    addAnalystGroup(
      map,
      "businessGroup",
      record.business_group_id,
      input.businessGroupMap.get(record.business_group_id)?.name ?? "Unmapped business group",
      record,
      ctx
    );
  }

  return Array.from(map.values())
    .map(({ supplierIds, riskSupplierIds, ...item }) => {
      const totalSpend = roundMoney(item.totalSpend);
      const unmanagedSpend = roundMoney(item.unmanagedSpend);
      const highRiskSpend = roundMoney(item.highRiskSpend);
      const coverageGapSpend = roundMoney(Math.max(item.totalSpend - item.managedSpend, 0));
      const quickFilters: SpendAnalystGroup["quickFilters"] = [];
      if (highRiskSpend > 0) quickFilters.push("high_risk");
      if (unmanagedSpend > 0) quickFilters.push("unmanaged");
      if (coverageGapSpend > 0) quickFilters.push("coverage_gap");
      if (item.groupBy === "supplier" && totalSpend > 0) quickFilters.push("top_supplier");

      return {
        ...item,
        totalSpend,
        managedSpend: roundMoney(item.managedSpend),
        unmanagedSpend,
        highRiskSpend,
        coverageGapSpend,
        riskSupplierCount: riskSupplierIds.size,
        opportunityImpact: roundMoney(unmanagedSpend + highRiskSpend + coverageGapSpend),
        quickFilters,
      };
    })
    .sort((a, b) => b.opportunityImpact - a.opportunityImpact || b.totalSpend - a.totalSpend)
    .slice(0, 40);
}

function buildSpendOpportunities(input: {
  kpis: SpendKpis;
  totalSpend: number;
  recordsCount: number;
  supplierBreakdown: SpendSupplierBreakdown[];
  categoryBreakdown: SpendSummaryNode[];
  analystWorkspace: SpendAnalystGroup[];
  contractCoverage: SpendContractCoverage;
}): SpendOpportunity[] {
  if (input.totalSpend <= 0) return [];
  const opportunities: SpendOpportunity[] = [];
  const pct = (value: number) => roundPct((value / input.totalSpend) * 100);

  if (input.kpis.unmanagedSpend > 0) {
    opportunities.push({
      id: "contract-leakage",
      type: "contract_leakage",
      title: "Contract leakage",
      impact: input.kpis.unmanagedSpend,
      confidence: input.contractCoverage.managedSupplierCount > 0 ? "high" : "low",
      affectedSupplierCount: input.contractCoverage.unmanagedSupplierCount,
      affectedRecordCount: input.analystWorkspace
        .filter((item) => item.groupBy === "supplier" && item.unmanagedSpend > 0)
        .reduce((sum, item) => sum + item.recordCount, 0),
      reason: `${pct(input.kpis.unmanagedSpend)}% of filtered spend is with suppliers that have no active contract.`,
      recommendedAction: "Prioritize contract review for the highest unmanaged suppliers.",
    });
  }

  if (input.kpis.highRiskSpend > 0) {
    opportunities.push({
      id: "high-risk-spend",
      type: "high_risk_spend",
      title: "High-risk spend reduction",
      impact: input.kpis.highRiskSpend,
      confidence: "medium",
      affectedSupplierCount: input.supplierBreakdown.filter((item) => isHighRisk(item.currentRiskLevel)).length,
      affectedRecordCount: input.analystWorkspace
        .filter((item) => item.groupBy === "supplier" && item.highRiskSpend > 0)
        .reduce((sum, item) => sum + item.recordCount, 0),
      reason: `${pct(input.kpis.highRiskSpend)}% of filtered spend is tied to high or critical risk suppliers.`,
      recommendedAction: "Move high-spend risky suppliers into mitigation or dual-source review.",
    });
  }

  const consolidation = input.analystWorkspace.find(
    (item) => item.groupBy === "category" && item.supplierCount >= 3
  );
  if (consolidation && input.recordsCount >= 5) {
    opportunities.push({
      id: "supplier-consolidation",
      type: "supplier_consolidation",
      title: "Supplier consolidation",
      impact: consolidation.totalSpend,
      confidence: consolidation.supplierCount >= 5 ? "high" : "medium",
      affectedSupplierCount: consolidation.supplierCount,
      affectedRecordCount: consolidation.recordCount,
      reason: `${consolidation.label} has ${consolidation.supplierCount} suppliers in the filtered spend set.`,
      recommendedAction: "Review category-level supplier overlap and consolidate comparable suppliers.",
    });
  }

  const supplierSpend = input.supplierBreakdown.map((item) => item.totalSpend);
  const tailThreshold = input.totalSpend * 0.02;
  const tailSuppliers = input.supplierBreakdown.filter((item) => item.totalSpend <= tailThreshold);
  const tailSpend = tailSuppliers.reduce((sum, item) => sum + item.totalSpend, 0);
  if (tailSpend > 0 && supplierSpend.length >= 5 && input.recordsCount >= 10) {
    opportunities.push({
      id: "tail-spend",
      type: "tail_spend",
      title: "Tail spend cleanup",
      impact: roundMoney(tailSpend),
      confidence: tailSuppliers.length >= 5 ? "medium" : "low",
      affectedSupplierCount: tailSuppliers.length,
      affectedRecordCount: tailSuppliers.reduce((sum, item) => sum + item.recordCount, 0),
      reason: `${tailSuppliers.length} low-spend suppliers sit below 2% of filtered spend each.`,
      recommendedAction: "Bundle low-value suppliers into preferred vendor or catalog channels.",
    });
  }

  const topCategory = input.categoryBreakdown[0];
  if (topCategory && pct(topCategory.totalSpend) >= 35) {
    opportunities.push({
      id: "category-concentration",
      type: "category_concentration",
      title: "Category concentration risk",
      impact: topCategory.totalSpend,
      confidence: "medium",
      affectedSupplierCount:
        input.analystWorkspace.find((item) => item.groupBy === "category" && item.id === topCategory.id)?.supplierCount ?? 0,
      affectedRecordCount: topCategory.recordCount,
      reason: `${topCategory.path} represents ${pct(topCategory.totalSpend)}% of filtered spend.`,
      recommendedAction: "Validate sourcing resilience and pricing leverage for the concentrated category.",
    });
  }

  return opportunities
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map((item) => ({ ...item, impact: roundMoney(item.impact) }));
}

export function buildSpendSummary(input: {
  records: SpendRecordRow[];
  categories: SpendDimensionRow[];
  regions: SpendDimensionRow[];
  businessGroups: SpendBusinessGroupRow[];
  supplierContext?: SpendSupplierContextRow[];
}): SpendSummaryResponse {
  const { records, categories, regions, businessGroups, supplierContext = [] } = input;

  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const regionMap = new Map(regions.map((item) => [item.id, item]));
  const businessGroupMap = new Map(businessGroups.map((item) => [item.id, item]));
  const contextMap = new Map(supplierContext.map((item) => [item.supplier_id, item]));

  const categoryAgg = new Map<string, SpendSummaryNode>();
  const regionAgg = new Map<string, SpendSummaryNode>();
  const businessGroupAgg = new Map<string, SpendBusinessGroupBreakdown>();
  const supplierAgg = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      totalSpend: number;
      recordCount: number;
      businessGroups: Set<string>;
      categorySpend: Map<string, number>;
      unmanagedSpend: number;
      highRiskSpend: number;
    }
  >();

  const currencies = new Set<string>();
  const trendAgg = new Map<string, SpendTrendPoint>();
  let managedSpend = 0;
  let highRiskSpend = 0;
  let criticalSupplierSpend = 0;
  let esgLowSpend = 0;
  let riskAdjustedSpend = 0;

  for (const record of records) {
    currencies.add(record.currency);
    const supplierContextItem = contextForSupplier(contextMap, record.supplier_id);
    const isManaged = supplierContextItem.active_contract_count > 0;
    const riskLevel = supplierContextItem.current_risk_level;
    const recordIsHighRisk = isHighRisk(riskLevel);
    const recordIsCritical = riskLevel?.toLowerCase() === "critical";
    if (isManaged) managedSpend += record.amount;
    if (recordIsHighRisk) highRiskSpend += record.amount;
    if (recordIsCritical) criticalSupplierSpend += record.amount;
    if (supplierContextItem.esg_score != null && supplierContextItem.esg_score < 50) esgLowSpend += record.amount;
    riskAdjustedSpend += record.amount * riskWeight(riskLevel);

    const period = record.spend_date.slice(0, 7);
    const trend = trendAgg.get(period);
    if (trend) {
      trend.totalSpend += record.amount;
      trend.recordCount += 1;
    } else {
      trendAgg.set(period, { period, totalSpend: record.amount, recordCount: 1 });
    }

    const category = categoryMap.get(record.category_id);
    if (category) {
      const path = buildPath(categoryMap, category.id);
      const existing = categoryAgg.get(category.id);
      if (existing) {
        existing.totalSpend += record.amount;
        existing.recordCount += 1;
      } else {
        categoryAgg.set(category.id, {
          id: category.id,
          name: category.name,
          path,
          level: category.level,
          parentId: category.parent_id,
          totalSpend: record.amount,
          recordCount: 1,
        });
      }
    }

    const region = regionMap.get(record.region_id);
    if (region) {
      const path = buildPath(regionMap, region.id);
      const existing = regionAgg.get(region.id);
      if (existing) {
        existing.totalSpend += record.amount;
        existing.recordCount += 1;
      } else {
        regionAgg.set(region.id, {
          id: region.id,
          name: region.name,
          path,
          level: region.level,
          parentId: region.parent_id,
          totalSpend: record.amount,
          recordCount: 1,
        });
      }
    }

    const businessGroup = businessGroupMap.get(record.business_group_id);
    if (businessGroup) {
      const existing = businessGroupAgg.get(businessGroup.id);
      if (existing) {
        existing.totalSpend += record.amount;
        existing.recordCount += 1;
      } else {
        businessGroupAgg.set(businessGroup.id, {
          id: businessGroup.id,
          name: businessGroup.name,
          totalSpend: record.amount,
          recordCount: 1,
        });
      }
    }

    const supplierName = record.supplier_name ?? "Unknown supplier";
    const supplier = supplierAgg.get(record.supplier_id);
    if (supplier) {
      supplier.totalSpend += record.amount;
      supplier.recordCount += 1;
      supplier.businessGroups.add(record.business_group_id);
      if (!isManaged) supplier.unmanagedSpend += record.amount;
      if (recordIsHighRisk) supplier.highRiskSpend += record.amount;
      supplier.categorySpend.set(
        record.category_id,
        (supplier.categorySpend.get(record.category_id) ?? 0) + record.amount
      );
    } else {
      supplierAgg.set(record.supplier_id, {
        supplierId: record.supplier_id,
        supplierName,
        totalSpend: record.amount,
        recordCount: 1,
        businessGroups: new Set([record.business_group_id]),
        categorySpend: new Map([[record.category_id, record.amount]]),
        unmanagedSpend: isManaged ? 0 : record.amount,
        highRiskSpend: recordIsHighRisk ? record.amount : 0,
      });
    }
  }

  const categoryBreakdown = sortBySpendDesc(
    Array.from(categoryAgg.values()).map((item) => ({
      ...item,
      totalSpend: roundMoney(item.totalSpend),
    }))
  );

  const regionBreakdown = sortBySpendDesc(
    Array.from(regionAgg.values()).map((item) => ({
      ...item,
      totalSpend: roundMoney(item.totalSpend),
    }))
  );

  const businessGroupBreakdown = sortBySpendDesc(
    Array.from(businessGroupAgg.values()).map((item) => ({
      ...item,
      totalSpend: roundMoney(item.totalSpend),
    }))
  );

  const supplierBreakdown = sortBySpendDesc(
    Array.from(supplierAgg.values()).map((item) => {
      let primaryCategoryPath: string | null = null;
      let topCategorySpend = -1;

      for (const [categoryId, total] of item.categorySpend.entries()) {
        if (total > topCategorySpend) {
          topCategorySpend = total;
          primaryCategoryPath = categoryMap.has(categoryId)
            ? buildPath(categoryMap, categoryId)
            : null;
        }
      }
      const ctx = contextForSupplier(contextMap, item.supplierId);
      const roundedTotalSpend = roundMoney(item.totalSpend);
      const coverage = contractCoverageStatus(
        roundedTotalSpend,
        ctx.active_contract_value,
        ctx.active_contract_count
      );
      const health = calculateHealth(ctx);

      return {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        totalSpend: roundedTotalSpend,
        recordCount: item.recordCount,
        primaryCategoryPath,
        businessGroupCount: item.businessGroups.size,
        currentRiskLevel: ctx.current_risk_level,
        latestPerformanceScore: ctx.latest_performance_score,
        esgScore: ctx.esg_score,
        activeContractCount: ctx.active_contract_count,
        activeContractValue: ctx.active_contract_value,
        isManaged: ctx.active_contract_count > 0,
        ...coverage,
        riskAdjustedSpend: roundMoney(item.totalSpend * riskWeight(ctx.current_risk_level)),
        ...health,
      };
    })
  );

  const totalSpend = roundMoney(records.reduce((sum, record) => sum + record.amount, 0));
  const unmanagedSpend = roundMoney(totalSpend - managedSpend);
  const topSupplierSpend = supplierBreakdown[0]?.totalSpend ?? 0;
  const kpis: SpendKpis = {
    totalSpend,
    managedSpend: roundMoney(managedSpend),
    managedSpendPct: totalSpend > 0 ? roundPct((managedSpend / totalSpend) * 100) : 0,
    unmanagedSpend,
    contractCoveragePct: totalSpend > 0 ? roundPct((managedSpend / totalSpend) * 100) : 0,
    highRiskSpend: roundMoney(highRiskSpend),
    criticalSupplierSpend: roundMoney(criticalSupplierSpend),
    esgLowSpend: roundMoney(esgLowSpend),
    topSupplierConcentrationPct: totalSpend > 0 ? roundPct((topSupplierSpend / totalSpend) * 100) : 0,
    riskAdjustedSpend: roundMoney(riskAdjustedSpend),
  };
  const trend = Array.from(trendAgg.values())
    .map((item) => ({ ...item, totalSpend: roundMoney(item.totalSpend) }))
    .sort((a, b) => a.period.localeCompare(b.period));
  const spendRows = records.map((record) => {
    const ctx = contextForSupplier(contextMap, record.supplier_id);
    return {
      id: record.id,
      supplierId: record.supplier_id,
      supplierName: record.supplier_name ?? "Unknown supplier",
      categoryPath: categoryMap.has(record.category_id) ? buildPath(categoryMap, record.category_id) : null,
      regionPath: regionMap.has(record.region_id) ? buildPath(regionMap, record.region_id) : null,
      businessGroupName: businessGroupMap.get(record.business_group_id)?.name ?? null,
      amount: roundMoney(record.amount),
      currency: record.currency,
      spendDate: record.spend_date,
      currentRiskLevel: ctx.current_risk_level,
      latestPerformanceScore: ctx.latest_performance_score,
      esgScore: ctx.esg_score,
      isManaged: ctx.active_contract_count > 0,
    };
  });
  const exportRows: SpendExportRow[] = spendRows.map((row) => ({
    spendId: row.id,
    spendDate: row.spendDate,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    categoryPath: row.categoryPath,
    regionPath: row.regionPath,
    businessGroupName: row.businessGroupName,
    amount: row.amount,
    currency: row.currency,
    managedStatus: row.isManaged ? "managed" : "unmanaged",
    riskLevel: row.currentRiskLevel,
    performanceScore: row.latestPerformanceScore,
    esgScore: row.esgScore,
  }));
  const unmanagedSuppliers = supplierBreakdown.filter((item) => !item.isManaged);
  const suppliersWithCoverageGap = supplierBreakdown
    .filter((item) => item.contractCoverageGap > 0)
    .sort((a, b) => b.contractCoverageGap - a.contractCoverageGap);
  const healthScores = supplierBreakdown
    .map((item) => item.healthScore)
    .filter((value): value is number => value != null);
  const supplierHealthSummary: SpendSupplierHealthSummary = {
    strongSupplierCount: supplierBreakdown.filter((item) => item.healthBand === "strong").length,
    watchSupplierCount: supplierBreakdown.filter((item) => item.healthBand === "watch").length,
    atRiskSupplierCount: supplierBreakdown.filter((item) => item.healthBand === "at_risk").length,
    unknownSupplierCount: supplierBreakdown.filter((item) => item.healthBand === "unknown").length,
    avgHealthScore:
      healthScores.length > 0
        ? roundPct(healthScores.reduce((sum, value) => sum + value, 0) / healthScores.length)
        : null,
  };
  const contractCoverage: SpendContractCoverage = {
    managedSpend: kpis.managedSpend,
    unmanagedSpend,
    coverageGapSpend: roundMoney(suppliersWithCoverageGap.reduce((sum, item) => sum + item.contractCoverageGap, 0)),
    managedSupplierCount: supplierBreakdown.filter((item) => item.isManaged).length,
    partiallyCoveredSupplierCount: supplierBreakdown.filter((item) => item.contractCoverageStatus === "partial").length,
    unmanagedSupplierCount: unmanagedSuppliers.length,
    suppliersWithoutActiveContract: unmanagedSuppliers.slice(0, 10),
    suppliersWithCoverageGap: suppliersWithCoverageGap.slice(0, 10),
  };
  const supplierRiskOverlay = supplierBreakdown
    .slice()
    .sort((a, b) => {
      const aRisk = riskWeight(a.currentRiskLevel);
      const bRisk = riskWeight(b.currentRiskLevel);
      if (bRisk !== aRisk) return bRisk - aRisk;
      return b.totalSpend - a.totalSpend;
    })
    .slice(0, 10);
  const analystWorkspace = buildAnalystWorkspace({
    records,
    supplierBreakdown,
    categoryMap,
    regionMap,
    businessGroupMap,
    contextMap,
  });
  const opportunities = buildSpendOpportunities({
    kpis,
    totalSpend,
    recordsCount: records.length,
    supplierBreakdown,
    categoryBreakdown,
    analystWorkspace,
    contractCoverage,
  });
  const dataQualityWarnings = [
    records.length > 0 && records.length < 10
      ? "Filtered slice has fewer than 10 spend records; tail-spend and consolidation signals are intentionally conservative."
      : null,
    supplierBreakdown.some((item) => item.contextCompleteness < 75)
      ? "Some suppliers are missing risk, ESG, performance, or contract context; confidence may be reduced."
      : null,
    contractCoverage.managedSupplierCount === 0 && records.length > 0
      ? "No active contracts were found for the filtered spend; contract leakage confidence is low."
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    totals: {
      totalSpend,
      recordsCount: records.length,
      supplierCount: supplierBreakdown.length,
      categoryCount: categoryBreakdown.length,
      regionCount: regionBreakdown.length,
      businessGroupCount: businessGroupBreakdown.length,
      currencies: Array.from(currencies).sort(),
    },
    kpis,
    filters: {
      categories: buildDimensionFilterOptions(categories, categoryMap, categoryAgg),
      regions: buildDimensionFilterOptions(regions, regionMap, regionAgg),
      suppliers: supplierBreakdown.map((item) => ({
        value: item.supplierId,
        label: item.supplierName,
        name: item.supplierName,
        totalSpend: item.totalSpend,
        recordCount: item.recordCount,
      })),
      businessGroups: businessGroups.map((item) => ({
        value: item.id,
        label: item.name,
        name: item.name,
        totalSpend: roundMoney(businessGroupAgg.get(item.id)?.totalSpend ?? 0),
        recordCount: businessGroupAgg.get(item.id)?.recordCount ?? 0,
      })),
    },
    categoryBreakdown,
    regionBreakdown,
    supplierBreakdown,
    businessGroupBreakdown,
    trend,
    spendRows,
    supplierRiskOverlay,
    contractCoverage,
    supplierHealthSummary,
    opportunities,
    analystWorkspace,
    exportRows,
    dataQualityWarnings,
  };
}

export async function getSpendSummaryService(
  filters: SpendSummaryFilters
): Promise<ServiceResult<SpendSummaryResponse>> {
  try {
    const [categories, regions, businessGroups] = await Promise.all([
      listSpendCategories(),
      listSpendRegions(),
      listSpendBusinessGroups(),
    ]);
    const recordFilters = {
      ...filters,
      categoryIds: getDescendantIdsForSelection(
        categories,
        filters.categoryIds?.length ? filters.categoryIds : filters.categoryId ? [filters.categoryId] : undefined
      ),
      regionIds: getDescendantIdsForSelection(
        regions,
        filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : undefined
      ),
      supplierIds: filters.supplierIds?.length
        ? filters.supplierIds
        : filters.supplierId
          ? [filters.supplierId]
          : undefined,
      businessGroupIds: filters.businessGroupIds?.length
        ? filters.businessGroupIds
        : filters.businessGroupId
          ? [filters.businessGroupId]
          : undefined,
    };
    const records = await listSpendRecords(recordFilters);
    const supplierContext = await listSpendSupplierContext(records.map((record) => record.supplier_id));

    return {
      ok: true,
      data: buildSpendSummary({ records, categories, regions, businessGroups, supplierContext }),
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      error: err?.message ?? "Failed to fetch spend summary",
    };
  }
}
