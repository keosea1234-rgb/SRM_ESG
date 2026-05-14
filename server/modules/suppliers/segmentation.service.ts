import { calcHealthScoreLite, healthBandFromScoreLite } from "./segmentation.util";

export type SupplierSegment =
  | "strategic"
  | "at_risk"
  | "esg_laggard"
  | "high_performer"
  | "single_source"
  | "watch"
  | "standard";

export const SUPPLIER_SEGMENTS: { key: SupplierSegment; label: string }[] = [
  { key: "strategic", label: "Strategic" },
  { key: "at_risk", label: "At Risk" },
  { key: "esg_laggard", label: "ESG Laggard" },
  { key: "high_performer", label: "High Performer" },
  { key: "single_source", label: "Single Source" },
  { key: "watch", label: "Watch" },
  { key: "standard", label: "Standard" },
];

export interface SupplierSummaryRowForSegmentation {
  id: string;
  latest_performance_score: number | null;
  current_risk_level: string | null;
  contract_count: number | null;
  overall_esg_score: number | null;
  esg_trend_delta_90d: number | null;
  overall_score: number | null;
  is_single_source: boolean;
}

function isAtRisk(row: SupplierSummaryRowForSegmentation, health: number | null): boolean {
  return Boolean((health != null && health < 4) || row.current_risk_level?.toLowerCase() === "critical");
}

function isEsgLaggard(row: SupplierSummaryRowForSegmentation): boolean {
  const esgLow = row.overall_esg_score != null && row.overall_esg_score < 40;
  const esgDecline = row.esg_trend_delta_90d != null && row.esg_trend_delta_90d < -10;
  return Boolean(esgLow || esgDecline);
}

function isStrategic(row: SupplierSummaryRowForSegmentation, health: number | null): boolean {
  return Boolean(health != null && health >= 8 && (row.contract_count ?? 0) >= 2);
}

function isHighPerformer(row: SupplierSummaryRowForSegmentation, health: number | null): boolean {
  const perf100 =
    row.overall_score != null
      ? row.overall_score
      : row.latest_performance_score != null
        ? row.latest_performance_score > 10
          ? row.latest_performance_score
          : row.latest_performance_score * 10
        : null;
  return Boolean(health != null && health >= 7 && perf100 != null && perf100 >= 75);
}

function isWatch(health: number | null): boolean {
  if (health == null) return false;
  return healthBandFromScoreLite(health) === "Watchlist";
}

export function classifySupplier(row: SupplierSummaryRowForSegmentation): SupplierSegment[] {
  const health = calcHealthScoreLite(
    row.latest_performance_score,
    row.current_risk_level,
    row.overall_esg_score,
  );

  const segments: SupplierSegment[] = [];
  if (isAtRisk(row, health)) segments.push("at_risk");
  if (isEsgLaggard(row)) segments.push("esg_laggard");
  if (isStrategic(row, health)) segments.push("strategic");
  if (isHighPerformer(row, health)) segments.push("high_performer");
  if (isWatch(health)) segments.push("watch");
  if (row.is_single_source) segments.push("single_source");

  const hasCoreSegment = segments.some((s) => s !== "single_source");
  if (!hasCoreSegment) segments.push("standard");
  return segments;
}

export function buildSegmentMap(rows: SupplierSummaryRowForSegmentation[]) {
  const bySegment: Record<SupplierSegment, string[]> = {
    strategic: [],
    at_risk: [],
    esg_laggard: [],
    high_performer: [],
    single_source: [],
    watch: [],
    standard: [],
  };
  const bySupplier: Record<string, SupplierSegment[]> = {};

  for (const row of rows) {
    const segments = classifySupplier(row);
    bySupplier[row.id] = segments;
    for (const segment of segments) bySegment[segment].push(row.id);
  }

  const counts = Object.fromEntries(
    Object.entries(bySegment).map(([k, v]) => [k, v.length]),
  ) as Record<SupplierSegment, number>;

  return {
    availableSegments: SUPPLIER_SEGMENTS,
    bySegment,
    bySupplier,
    counts,
  };
}
