import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GitCompare, Loader2, Search, X } from "lucide-react";
import { queryKeys } from "../lib/queryKeys";
import { fetchComparison, fetchSuppliersPool } from "../services/suppliers";
import type { ComparisonSupplier, SupplierSummary } from "../types";
import { useHasRole } from "../context/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";

type ScoreKind = "hundred" | "ten" | "risk1to5" | "none";

const statusBadge: Record<string, string> = {
  active: "badge-active",
  inactive: "badge-inactive",
  blacklisted: "badge-blacklisted",
  pending: "badge-pending",
};

function scoreBgClass(value: number | null, kind: ScoreKind): string {
  if (value === null || kind === "none") return "bg-white text-surface-400";
  let pct = value;
  if (kind === "ten") pct = value * 10;
  if (kind === "risk1to5") pct = ((value - 1) / 4) * 100;
  if (pct >= 70) return "bg-green-50 text-green-700";
  if (pct >= 40) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

function riskLevelBgClass(level: string | null): string {
  if (!level) return "bg-white text-surface-400";
  const k = level.toLowerCase();
  if (k === "low") return "bg-green-50 text-green-700 border border-green-200";
  if (k === "medium") return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  if (k === "high") return "bg-red-50 text-red-700 border border-red-200";
  if (k === "critical") return "bg-red-100 text-red-800 border border-red-300 font-semibold";
  return "bg-surface-50 text-surface-700 border border-surface-200";
}

function formatEur(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtScore(v: number | null, decimals = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

type RowDef = {
  key: string;
  label: string;
  section?: "overview" | "performance" | "esg" | "risk";
  get: (s: ComparisonSupplier) => string | number | null;
  kind: "text" | "status" | "riskLevel" | "currency" | ScoreKind;
  /** For ▲: higher is better unless "lower" */
  best?: "higher" | "lower";
};

const TABLE_ROWS: RowDef[] = [
  { key: "o-status", label: "Status", section: "overview", get: (s) => s.status, kind: "status" },
  { key: "o-industry", label: "Industry", section: "overview", get: (s) => s.industry, kind: "text" },
  { key: "o-contract", label: "Contract value", section: "overview", get: (s) => s.contract_value, kind: "currency", best: "higher" },

  { key: "p-overall", label: "Overall score", section: "performance", get: (s) => s.performance.overall, kind: "ten", best: "higher" },
  { key: "p-quality", label: "Quality", section: "performance", get: (s) => s.performance.quality, kind: "ten", best: "higher" },
  { key: "p-delivery", label: "Delivery", section: "performance", get: (s) => s.performance.delivery, kind: "ten", best: "higher" },
  { key: "p-price", label: "Price", section: "performance", get: (s) => s.performance.price, kind: "ten", best: "higher" },
  { key: "p-comm", label: "Communication", section: "performance", get: (s) => s.performance.communication, kind: "ten", best: "higher" },

  { key: "e-overall", label: "Overall ESG", section: "esg", get: (s) => s.esg.overall, kind: "hundred", best: "higher" },
  { key: "e-env", label: "Environmental", section: "esg", get: (s) => s.esg.env, kind: "hundred", best: "higher" },
  { key: "e-soc", label: "Social", section: "esg", get: (s) => s.esg.social, kind: "hundred", best: "higher" },
  { key: "e-gov", label: "Governance", section: "esg", get: (s) => s.esg.gov, kind: "hundred", best: "higher" },

  { key: "r-level", label: "Risk level", section: "risk", get: (s) => s.risk.level, kind: "riskLevel" },
  { key: "r-fin", label: "Financial", section: "risk", get: (s) => s.risk.financial, kind: "risk1to5", best: "lower" },
  { key: "r-op", label: "Operational", section: "risk", get: (s) => s.risk.operational, kind: "risk1to5", best: "lower" },
  { key: "r-comp", label: "Compliance", section: "risk", get: (s) => s.risk.compliance, kind: "risk1to5", best: "lower" },
  { key: "r-geo", label: "Geopolitical", section: "risk", get: (s) => s.risk.geopolitical, kind: "risk1to5", best: "lower" },
  { key: "r-rep", label: "Reputational", section: "risk", get: (s) => s.risk.reputational, kind: "risk1to5", best: "lower" },
];

function sectionHeaderClass(section: RowDef["section"]): string {
  switch (section) {
    case "performance":
      return "bg-brand-600 text-white";
    case "esg":
      return "bg-teal-700 text-white";
    case "risk":
      return "bg-red-700 text-white";
    default:
      return "bg-surface-800 text-white";
  }
}

function sectionTitle(section: RowDef["section"]): string {
  switch (section) {
    case "overview":
      return "Overview";
    case "performance":
      return "Performance";
    case "esg":
      return "ESG";
    case "risk":
      return "Risk";
    default:
      return "";
  }
}

function numericValuesForBest(row: RowDef, suppliers: ComparisonSupplier[]): number[] {
  if (!row.best) return [];
  const raw = suppliers.map((s) => row.get(s));
  const nums = raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length !== suppliers.length) return [];
  return nums;
}

function isBestInRow(row: RowDef, suppliers: ComparisonSupplier[], supplier: ComparisonSupplier): boolean {
  const nums = numericValuesForBest(row, suppliers);
  if (nums.length < 2) return false;
  const v = row.get(supplier);
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  if (row.best === "higher") return v === Math.max(...nums);
  return v === Math.min(...nums);
}

export default function ComparisonPage() {
  usePageTitle("Compare");
  const allowed = useHasRole("admin", "procurement_manager");

  const { data: pool = [], isLoading: poolLoading, error: poolErr } = useQuery({
    queryKey: queryKeys.suppliersPool(),
    queryFn: fetchSuppliersPool,
  });
  const poolError = poolErr ? (poolErr as Error).message : null;

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<SupplierSummary[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [shouldCompare, setShouldCompare] = useState(false);

  const selectedIds = useMemo(() => selected.map((s) => s.id), [selected]);

  const {
    data: comparisonData,
    isFetching: compareLoading,
    error: compareErr,
  } = useQuery({
    queryKey: queryKeys.comparison(selectedIds),
    queryFn: () => fetchComparison(selectedIds),
    enabled: shouldCompare && selectedIds.length >= 2 && selectedIds.length <= 5,
  });

  const compareError = compareErr ? (compareErr as Error).message : null;
  const rows = shouldCompare ? comparisonData ?? null : null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setShouldCompare(false);
  }, [selectedIds.join(",")]);

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selectedIds = new Set(selected.map((s) => s.id));
    return pool.filter((s) => {
      if (selectedIds.has(s.id)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q);
    });
  }, [pool, search, selected]);

  const addSupplier = useCallback((s: SupplierSummary) => {
    setSelected((prev) => {
      if (prev.length >= 5 || prev.some((x) => x.id === s.id)) return prev;
      return [...prev, s];
    });
    setSearch("");
    setDropdownOpen(false);
  }, []);

  const removeSupplier = useCallback((id: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const runCompare = useCallback(() => {
    if (selected.length < 2 || selected.length > 5) return;
    setShouldCompare(true);
  }, [selected]);

  const groupedRows = useMemo(() => {
    const groups: { section: NonNullable<RowDef["section"]>; rows: RowDef[] }[] = [];
    let current: (typeof groups)[number] | null = null;
    for (const r of TABLE_ROWS) {
      const sec = r.section ?? "overview";
      if (!current || current.section !== sec) {
        current = { section: sec, rows: [] };
        groups.push(current);
      }
      current.rows.push(r);
    }
    return groups;
  }, []);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  const canCompare = selected.length >= 2 && selected.length <= 5 && !compareLoading;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
          <GitCompare className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-surface-900">Compare suppliers</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Select 2–5 suppliers and compare ESG, performance, and risk side by side.
          </p>
        </div>
      </div>

      {/* Selection */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">Suppliers</p>
        <div ref={wrapRef} className="relative">
          <div className="flex flex-wrap items-center gap-2">
            {selected.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium
                           bg-brand-50 text-brand-800 border border-brand-200"
              >
                {s.name}
                <button
                  type="button"
                  onClick={() => removeSupplier(s.id)}
                  className="p-0.5 rounded-full hover:bg-brand-100 text-brand-700"
                  aria-label={`Remove ${s.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {selected.length < 5 && (
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none z-10" />
                <input
                  type="text"
                  className="input-field w-full pl-9 text-sm"
                  placeholder="Search suppliers to add…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  aria-autocomplete="list"
                  aria-expanded={dropdownOpen}
                />
                {dropdownOpen && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {poolLoading ? (
                      <div className="flex items-center justify-center py-8 text-surface-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : poolError ? (
                      <p className="px-3 py-4 text-sm text-red-600">{poolError}</p>
                    ) : filteredPool.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-surface-400">No suppliers to add.</p>
                    ) : (
                      <ul className="py-1">
                        {filteredPool.slice(0, 50).map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm text-surface-800 hover:bg-surface-50"
                              onClick={() => addSupplier(s)}
                            >
                              <span className="font-medium">{s.name}</span>
                              {s.industry ? (
                                <span className="block text-xs text-surface-500">{s.industry}</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!canCompare}
            onClick={() => void runCompare()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {compareLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Compare
              </span>
            ) : (
              "Compare"
            )}
          </button>
          <span className="text-xs text-surface-400">{selected.length} / 5 selected</span>
        </div>
        {shouldCompare && compareError && <p className="text-sm text-red-600">{compareError}</p>}
      </div>

      {/* Results */}
      {compareLoading && (
        <div className="flex items-center justify-center py-16 text-surface-500">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      )}

      {rows && rows.length > 0 && !compareLoading && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="text-sm font-semibold text-surface-900">Comparison results</h2>
            <p className="text-xs text-surface-400 mt-0.5">▲ marks the best value in each numeric row (when all cells are filled).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/80">
                  <th
                    className="sticky left-0 z-20 bg-surface-50/95 backdrop-blur-sm text-left px-4 py-3 font-semibold text-surface-600
                               border-r border-surface-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] w-44 min-w-[11rem]"
                  >
                    Metric
                  </th>
                  {rows.map((s) => (
                    <th
                      key={s.id}
                      className="text-left px-4 py-3 font-semibold text-surface-900 whitespace-nowrap min-w-[8rem]"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={`sec-${group.section}`}>
                    <tr>
                      <td
                        className={`sticky left-0 z-10 border-r border-surface-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] p-0 ${sectionHeaderClass(group.section)}`}
                      />
                      <td
                        colSpan={rows.length}
                        className={`px-4 py-2 font-display font-semibold text-sm ${sectionHeaderClass(group.section)}`}
                      >
                        {sectionTitle(group.section)}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.key} className="border-b border-surface-100 hover:bg-surface-50/40">
                        <td
                          className="sticky left-0 z-10 bg-white text-surface-700 font-medium px-4 py-2.5 border-r border-surface-200
                                     shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]"
                        >
                          {row.label}
                        </td>
                        {rows.map((s) => {
                          const raw = row.get(s);
                          const showBest = isBestInRow(row, rows, s);
                          const cellClass = "px-4 py-2.5 align-middle";

                          if (row.kind === "status" && typeof raw === "string" && raw) {
                            const badge = statusBadge[raw] ?? "badge-inactive";
                            return (
                              <td key={s.id} className={cellClass}>
                                <span className={`badge ${badge}`}>{raw}</span>
                              </td>
                            );
                          }
                          if (row.kind === "riskLevel") {
                            const level = raw && typeof raw === "string" ? String(raw).toLowerCase() : null;
                            return (
                              <td key={s.id} className={cellClass}>
                                {level ? (
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium capitalize ${riskLevelBgClass(String(raw))}`}
                                  >
                                    {String(raw)}
                                  </span>
                                ) : (
                                  <span className="text-surface-400">—</span>
                                )}
                              </td>
                            );
                          }
                          if (row.kind === "currency") {
                            const n = typeof raw === "number" ? raw : null;
                            return (
                              <td key={s.id} className={cellClass}>
                                <span className="tabular-nums">{formatEur(n)}</span>
                                {showBest && n !== null ? (
                                  <span className="ml-1 text-green-700 text-xs" title="Highest contract value">
                                    ▲
                                  </span>
                                ) : null}
                              </td>
                            );
                          }
                          if (row.kind === "text") {
                            const t = raw === null || raw === "" ? null : String(raw);
                            return (
                              <td key={s.id} className={`${cellClass} text-surface-800`}>
                                {t ?? <span className="text-surface-400">—</span>}
                              </td>
                            );
                          }
                          const v = typeof raw === "number" ? raw : null;
                          const sk = row.kind as Exclude<RowDef["kind"], "text" | "status" | "riskLevel" | "currency">;
                          const bg = scoreBgClass(v, sk);
                          return (
                            <td key={s.id} className={`${cellClass} ${bg}`}>
                              <span className="tabular-nums font-medium">
                                {v === null ? (
                                  <span className="text-surface-400 font-normal">—</span>
                                ) : (
                                  fmtScore(v, row.kind === "hundred" ? 0 : 1)
                                )}
                              </span>
                              {showBest ? (
                                <span className="ml-1 text-surface-700 text-xs" title="Best in row">
                                  ▲
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
