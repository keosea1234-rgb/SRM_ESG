import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  LayoutGrid,
  List,
  X,
  Download,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { apiPost } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { fetchSupplierList, fetchSupplierESG, fetchSupplierSegments, type SupplierSegment } from "../services/suppliers";
import { fetchDashboardStats } from "../services/dashboard";
import { calcHealthScore } from "../lib/healthScore";
import type { SupplierSummary } from "../types";
import { usePermissions } from "../context/AuthContext";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import SupplierSlideOver from "../components/SupplierSlideOver";
import { useFilterState } from "../hooks/useFilterState";
import { COUNTRIES } from "../lib/countries";
import { Skeleton } from "../components/ui/Skeleton";
import { usePageTitle } from "../hooks/usePageTitle";

const statusConfig: Record<string, { label: string; className: string }> = {
  active:      { label: "Active",      className: "badge-active" },
  inactive:    { label: "Inactive",    className: "badge-inactive" },
  blacklisted: { label: "Blacklisted", className: "badge-blacklisted" },
  pending:     { label: "Pending",     className: "badge-pending" },
};

const riskConfig: Record<string, { label: string; className: string }> = {
  low:      { label: "Low",      className: "risk-low" },
  medium:   { label: "Medium",   className: "risk-medium" },
  high:     { label: "High",     className: "risk-high" },
  critical: { label: "Critical", className: "risk-critical" },
};

function scoreTierPillClasses(score: number) {
  if (score >= 8) return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (score >= 6) return "bg-brand-100 text-brand-800 border border-brand-300";
  if (score >= 4) return "bg-amber-100 text-amber-800 border border-amber-300";
  return "bg-red-100 text-red-800 border border-red-300";
}

function healthDot(value: number | string | null, type: "perf" | "risk") {
  if (type === "perf") {
    const score = value as number | null;
    if (score == null) return <span className="w-2.5 h-2.5 rounded-full bg-surface-200" title="Performance: no data" />;
    const cls = score >= 7 ? "bg-emerald-400" : score >= 4 ? "bg-amber-400" : "bg-red-400";
    return <span className={`w-2.5 h-2.5 rounded-full ${cls}`} title={`Performance: ${score.toFixed(1)}`} />;
  }
  if (type === "risk") {
    const level = value as string | null;
    if (!level) return <span className="w-2.5 h-2.5 rounded-full bg-surface-200" title="Risk: no data" />;
    const cls = level === "low" ? "bg-emerald-400" : level === "medium" ? "bg-amber-400" : "bg-red-400";
    return <span className={`w-2.5 h-2.5 rounded-full ${cls}`} title={`Risk: ${level}`} />;
  }
}

const emptyForm = {
  name: "", tax_id: "", email: "", phone: "", website: "",
  address: "", city: "", country: "Turkey", industry: "",
  company_size: "" as string, status: "active", parent_id: "",
};

export default function SupplierList() {
  const permissions = usePermissions();

  usePageTitle("Suppliers");

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: { search: "", status: "all", segment: "all" },
    debounceKeys: ["search"],
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const view: "table" | "cards" = searchParams.get("view") === "cards" ? "cards" : "table";
  function setView(next: "table" | "cards") {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "table") p.delete("view");
        else p.set("view", "cards");
        return p;
      },
      { replace: true }
    );
  }

  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<"name" | "performance" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.status, filters.segment]);

  const { data: listData, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.suppliers({
      search: filters.search as string,
      status: filters.status as string,
      page: currentPage,
    }),
    queryFn: () =>
      fetchSupplierList({
        search: filters.search as string,
        status: filters.status as string,
        page: currentPage,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: portfolioStats } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchDashboardStats(),
  });
  const { data: segmentData } = useQuery({
    queryKey: queryKeys.supplierSegments(),
    queryFn: () => fetchSupplierSegments(),
    staleTime: 1000 * 60 * 5,
  });

  const suppliers = listData?.data ?? [];
  const supplierIds = useMemo(() => suppliers.map((s) => s.id), [suppliers]);

  const esgQueries = useQueries({
    queries: supplierIds.map((id) => ({
      queryKey: queryKeys.supplierESG(id),
      queryFn: () => fetchSupplierESG(id),
      staleTime: 1000 * 60 * 5,
    })),
  });

  const esgBySupplier = useMemo(() => {
    const map = new Map<string, number | null>();
    supplierIds.forEach((sid, i) => {
      const row = esgQueries[i]?.data;
      if (row) map.set(sid, row.overall_esg_score);
    });
    return map;
  }, [supplierIds, esgQueries]);

  function toggleSort(key: "name" | "performance") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortedSuppliers = useMemo(() => {
    const selectedSegment = (filters.segment as string) || "all";
    const filtered =
      selectedSegment === "all"
        ? suppliers
        : suppliers.filter((s) => segmentData?.bySupplier?.[s.id]?.includes(selectedSegment as SupplierSegment));

    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortKey === "performance") {
        const ap = a.latest_performance_score ?? -1;
        const bp = b.latest_performance_score ?? -1;
        return sortDir === "asc" ? ap - bp : bp - ap;
      }
      return 0;
    });
  }, [suppliers, sortKey, sortDir, filters.segment, segmentData?.bySupplier]);

  const supplierListFilterFields = useMemo<FilterFieldConfig[]>(() => {
    const preferredOrder: SupplierSegment[] = [
      "strategic",
      "at_risk",
      "esg_laggard",
      "high_performer",
      "watch",
    ];
    const labels = new Map((segmentData?.availableSegments ?? []).map((s) => [s.key, s.label]));
    return [
      { key: "search", type: "search", placeholder: "Search suppliers..." },
      {
        key: "status",
        type: "select",
        options: [
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "pending", label: "Pending" },
          { value: "blacklisted", label: "Blacklisted" },
        ],
        minWidth: "150px",
      },
      {
        key: "segment",
        type: "select",
        options: [
          { value: "all", label: "All segments" },
          ...preferredOrder.map((key) => ({ value: key, label: labels.get(key) ?? key })),
        ],
        minWidth: "170px",
      },
    ];
  }, [segmentData?.availableSegments]);

  const totalCount = listData?.pagination?.total ?? 0;
  const totalPages = listData?.pagination?.totalPages ?? 1;
  const pagination = {
    total: totalCount,
    page: currentPage,
    limit: 20,
    totalPages,
  };

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);

  // ── CSV Export ───────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      const search = (filters.search as string).trim();
      const status = filters.status as string;
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);

      const { getAuthToken } = await import("../lib/supabase");
      const token = await getAuthToken();

      const res = await fetch(
        `http://localhost:3001/api/suppliers/export?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suppliers_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string> = { name: form.name, status: form.status };
      if (form.tax_id)      body.tax_id      = form.tax_id;
      if (form.email)       body.email       = form.email;
      if (form.phone)       body.phone       = form.phone;
      if (form.website)     body.website     = form.website;
      if (form.address)     body.address     = form.address;
      if (form.city)        body.city        = form.city;
      if (form.country)     body.country     = form.country;
      if (form.industry)    body.industry    = form.industry;
      if (form.company_size) body.company_size = form.company_size;
      if (form.parent_id) body.parent_id = form.parent_id;

      await apiPost<SupplierSummary>("/api/suppliers", body);
      setShowModal(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-4 w-56 max-w-full mt-2 rounded" />
            <div className="mt-2 flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-surface-200 px-4 py-3 flex items-center gap-3"
            >
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-12 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 border-b-2 border-surface-200">
                <th className="w-1 p-0" aria-hidden />
                {["Supplier", "Status", "Industry", "Perf", "Risk", "Health", "Contracts"].map(
                  (label) => (
                    <th key={label} className="px-5 py-3.5 text-left">
                      <Skeleton className="h-3 w-20 rounded" />
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, r) => (
                <tr key={r} className="border-b border-surface-100">
                  <td className="w-1 p-0" aria-hidden />
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="space-y-2 min-w-0 flex-1">
                        <Skeleton className="h-4 w-40 max-w-full rounded" />
                        <Skeleton className="h-3 w-32 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-24 rounded" />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Skeleton className="h-6 w-14 rounded mx-auto" />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Skeleton className="h-6 w-16 rounded-full mx-auto" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Skeleton className="h-6 w-14 rounded mx-auto" />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Skeleton className="h-4 w-8 rounded mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-24">
        <p className="text-red-600 text-sm">{error instanceof Error ? error.message : String(error)}</p>
        <button
          onClick={() => void refetch()}
          className="btn-secondary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-surface-900">Suppliers</h1>
          <p className="text-sm text-surface-500 mt-1">
            {pagination.total} suppliers registered
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              At Risk ({segmentData?.counts?.at_risk ?? 0})
            </span>
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              ESG Laggard ({segmentData?.counts?.esg_laggard ?? 0})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            {exporting ? "Exporting..." : "Export CSV"}
          </button>

          {permissions.canManageSuppliers && (
            <button
              onClick={() => { setShowModal(true); setSaveError(null); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Supplier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <div className="bg-white rounded-xl border border-surface-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            {portfolioStats == null ? (
              <div className="h-5 w-8 bg-surface-100 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-surface-900">{portfolioStats.totalSuppliers}</div>
            )}
            <div className="text-xs text-surface-500 mt-0.5">Total Suppliers</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            {portfolioStats == null ? (
              <div className="h-5 w-8 bg-surface-100 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-surface-900">{portfolioStats.activeSuppliers}</div>
            )}
            <div className="text-xs text-surface-500 mt-0.5">Active</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-50 text-red-600">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            {portfolioStats == null ? (
              <div className="h-5 w-8 bg-surface-100 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-surface-900">{portfolioStats.highRiskCount}</div>
            )}
            <div className="text-xs text-surface-500 mt-0.5">High Risk</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            {portfolioStats == null ? (
              <div className="h-5 w-8 bg-surface-100 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-surface-900">
                {portfolioStats.avgPerformanceScore ?? "—"}
              </div>
            )}
            <div className="text-xs text-surface-500 mt-0.5">Avg Performance</div>
          </div>
        </div>
      </div>

      <FilterBar
        fields={supplierListFilterFields}
        values={filters}
        onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
        onReset={resetFilters}
        activeCount={activeCount}
      />

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setView(view === "table" ? "cards" : "table")}
          className="btn-secondary flex items-center gap-2"
          title={view === "table" ? "Switch to card view" : "Switch to table view"}
        >
          {view === "table" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
          {view === "table" ? "Card view" : "Table view"}
        </button>
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSuppliers.length === 0 ? (
            <div className="card p-12 text-center sm:col-span-2 xl:col-span-3">
              <Building2 className="w-8 h-8 text-surface-300 mx-auto mb-2" />
              <p className="text-sm text-surface-500">No suppliers found</p>
              <p className="text-xs text-surface-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            sortedSuppliers.map((s) => {
              const statusCfg = statusConfig[s.status] ?? { label: s.status, className: "" };
              const riskCfg = s.current_risk_level ? riskConfig[s.current_risk_level] : null;

              const perf = s.latest_performance_score ?? null; // 0–10
              const overallEsg = esgBySupplier.get(s.id) ?? null; // 0–100

              const perfPct = perf == null ? 0 : Math.max(0, Math.min(100, (perf / 10) * 100));
              const perfFill =
                perf == null ? "bg-surface-200" : perf >= 7 ? "bg-emerald-500" : perf >= 4 ? "bg-amber-500" : "bg-red-500";

              const riskPct =
                s.current_risk_level === "low"
                  ? 25
                  : s.current_risk_level === "medium"
                    ? 50
                    : s.current_risk_level === "high"
                      ? 75
                      : s.current_risk_level === "critical"
                        ? 100
                        : 0;
              const riskFill =
                s.current_risk_level === "low"
                  ? "bg-emerald-500"
                  : s.current_risk_level === "medium"
                    ? "bg-amber-500"
                    : s.current_risk_level === "high" || s.current_risk_level === "critical"
                      ? "bg-red-500"
                      : "bg-surface-200";

              const esgPct = overallEsg == null ? 0 : Math.max(0, Math.min(100, overallEsg));
              const esgFill =
                overallEsg == null ? "bg-surface-200" : overallEsg >= 70 ? "bg-emerald-500" : overallEsg >= 50 ? "bg-amber-500" : "bg-red-500";

              const initial = (s.name?.trim()?.[0] ?? "S").toUpperCase();

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSupplier(s)}
                  className="card p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-semibold shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate">{s.name}</p>
                        <p className="text-xs text-surface-400 truncate">{s.industry ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {riskCfg && (
                        <span className={`badge ${riskCfg.className}`} title={`Risk: ${riskCfg.label}`}>
                          {riskCfg.label}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                          s.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-100 text-surface-500"
                        }`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden" title={perf == null ? "Performance: —" : `Performance: ${perf.toFixed(1)}/10`}>
                      <div className={`h-full ${perfFill}`} style={{ width: `${perfPct}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden" title={s.current_risk_level ? `Risk: ${s.current_risk_level}` : "Risk: —"}>
                      <div className={`h-full ${riskFill}`} style={{ width: `${riskPct}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden" title={overallEsg == null ? "ESG: —" : `ESG: ${overallEsg}/100`}>
                      <div className={`h-full ${esgFill}`} style={{ width: `${esgPct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        /* Table */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 border-b-2 border-surface-200">
                <th className="w-1 p-0" aria-hidden />
                <th className="text-left px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 cursor-pointer hover:text-surface-700 font-bold uppercase tracking-wider text-xs"
                  >
                    Supplier{" "}
                    {sortKey === "name" ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">Industry</th>
                <th className="text-center px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => toggleSort("performance")}
                    className="flex items-center justify-center gap-1 cursor-pointer hover:text-surface-700 font-bold uppercase tracking-wider text-xs w-full"
                  >
                    Performance{" "}
                    {sortKey === "performance" ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="text-center px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider text-center">Health</th>
                <th className="text-center px-5 py-3.5 text-xs font-bold text-surface-600 uppercase tracking-wider">Contracts</th>
              </tr>
            </thead>
            <tbody>
              {sortedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Building2 className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">No suppliers found</p>
                    <p className="text-xs text-surface-400 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                sortedSuppliers.map((s) => {
                  const statusCfg = statusConfig[s.status] ?? { label: s.status, className: "" };
                  const riskCfg = s.current_risk_level
                    ? riskConfig[s.current_risk_level]
                    : null;
                  const locationLine =
                    s.city && s.country
                      ? `${s.city}, ${s.country}`
                      : (s.city ?? s.country ?? "");

                  const perf = s.latest_performance_score;
                  const overallEsg = esgBySupplier.get(s.id) ?? null;
                  const compositeHealth = calcHealthScore(
                    s.latest_performance_score ?? null,
                    s.current_risk_level as string | null,
                    overallEsg
                  );

                  const esgNorm = compositeHealth?.breakdown.esgNorm;
                  let esgDotClass = "bg-surface-200";
                  let esgDotTitle = "ESG: no assessment";
                  if (esgNorm != null) {
                    esgDotClass =
                      esgNorm >= 7 ? "bg-emerald-400" : esgNorm >= 4 ? "bg-amber-400" : "bg-red-400";
                    const esg100 = Math.round(esgNorm * 10);
                    esgDotTitle = `ESG ${esg100}/100 · Health ${compositeHealth?.score ?? "—"}`;
                  } else if (compositeHealth != null) {
                    esgDotTitle = `ESG: no assessment · Health ${compositeHealth.score}`;
                  }
                  return (
                    <tr
                      key={s.id}
                      className="group border-b border-surface-100 transition-colors cursor-pointer hover:bg-brand-50/40"
                      onClick={() => setSelectedSupplier(s)}
                    >
                      <td className="w-1 p-0">
                        <div className="h-full w-1 group-hover:bg-brand-500 transition-colors rounded-r-sm" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-brand-600" />
                          </div>
                          <div>
                          <Link
                            to={`/suppliers/${s.id}`}
                            className="text-base font-semibold text-surface-900 hover:text-brand-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.name}
                          </Link>
                          {s.parent_name ? (
                            <p className="text-[10px] text-surface-400 mt-0.5">↳ {s.parent_name}</p>
                          ) : locationLine ? (
                            <p className="text-xs text-surface-400 mt-0.5">{locationLine}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${statusCfg.className}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-surface-600">
                      {s.industry ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {perf != null ? (
                        <span
                          className={`inline-flex items-center justify-center w-14 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTierPillClasses(perf)}`}
                        >
                          {perf.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-sm text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {riskCfg
                        ? <span className={`badge ${riskCfg.className}`}>{riskCfg.label}</span>
                        : <span className="text-surface-300 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {healthDot(s.latest_performance_score, "perf")}
                        {healthDot(s.current_risk_level, "risk")}
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${esgDotClass}`}
                          title={esgDotTitle}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-surface-600">
                      {s.contract_count ?? 0}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100">
            <p className="text-xs text-surface-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs rounded-md border border-surface-200
                           disabled:opacity-40 hover:bg-surface-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs rounded-md border border-surface-200
                           disabled:opacity-40 hover:bg-surface-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* New Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 className="text-base font-semibold text-surface-900">New Supplier</h2>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-surface-600">Company Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field w-full" placeholder="Acme Corp" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Tax ID</label>
                  <input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                    className="input-field w-full" placeholder="TR1234567890" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input-field w-full">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field w-full" placeholder="contact@acme.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-field w-full" placeholder="+90 555 000 0000" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="input-field w-full" placeholder="Istanbul" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Country</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm
                               text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    <option value="">Select country…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Industry</label>
                  <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="input-field w-full" placeholder="Technology" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-600">Company Size</label>
                  <select value={form.company_size} onChange={(e) => setForm({ ...form, company_size: e.target.value })}
                    className="input-field w-full">
                    <option value="">—</option>
                    <option value="micro">Micro</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-600">Parent Company</label>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm
                             text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                >
                  <option value="">None (standalone)</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-surface-400">Optional — select if this is a subsidiary</p>
              </div>
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-surface-600 hover:bg-surface-50 rounded-lg border border-surface-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="btn-primary disabled:opacity-50">
                  {saving ? "Creating..." : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SupplierSlideOver supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
    </div>
  );
}
