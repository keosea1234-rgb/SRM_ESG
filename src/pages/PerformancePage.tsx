import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Plus, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import ESGScoreRing from "../components/ESGScoreRing";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import { usePageTitle } from "../hooks/usePageTitle";
import { apiPost } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import {
  fetchPerformanceSummary,
  fetchPerformanceSuppliers,
  type PerformanceSummaryRow,
} from "../services/performance";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { useAuth, useHasRole } from "../context/AuthContext";

type MetricFilter = "overall" | "quality" | "delivery" | "price" | "communication";

type PerfTableSortKey =
  | "supplier"
  | "period"
  | "overall"
  | "quality"
  | "delivery"
  | "price"
  | "communication";

type PerfEvalKpiCard =
  | { label: string; value: number; max: number; color: string; subtitle?: string }
  | { label: string; value: number; max: null; color: string };

const METRIC_KPI_LABELS: Record<MetricFilter, string> = {
  overall: "Avg Overall Score",
  quality: "Avg Quality Score",
  delivery: "Avg Delivery Score",
  price: "Avg Price Score",
  communication: "Avg Communication Score",
};

const SUPPLIER_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-600 font-semibold";
  if (score >= 6) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

function getScoreBarColor(score: number): string {
  if (score >= 8) return "bg-green-600";
  if (score >= 6) return "bg-yellow-600";
  return "bg-red-600";
}

/** Matches table: API often nests name under srm_suppliers; flat supplier_name may be empty. */
function getSupplierDisplayName(r: PerformanceSummaryRow): string {
  const nested = r.srm_suppliers?.name;
  if (nested != null && String(nested).trim() !== "") return String(nested);
  if (r.supplier_name?.trim()) return r.supplier_name;
  return r.supplier_id;
}

function getRowIndustry(r: PerformanceSummaryRow): string | null {
  const nested = r.srm_suppliers?.industry;
  if (nested != null && String(nested).trim() !== "") return String(nested);
  return null;
}

function getMetricScore(row: PerformanceSummaryRow, metric: MetricFilter): number {
  switch (metric) {
    case "quality":
      return row.quality_score;
    case "delivery":
      return row.delivery_score;
    case "price":
      return row.price_score;
    case "communication":
      return row.communication_score;
    default:
      return row.overall_score;
  }
}

function monthToQuarter(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

type AssessmentForm = {
  supplier_id: string;
  evaluation_month: string;
  quality_score: string;
  delivery_score: string;
  price_score: string;
  communication_score: string;
  notes: string;
};

function createEmptyAssessmentForm(): AssessmentForm {
  return {
    supplier_id: "",
    evaluation_month: "",
    quality_score: "",
    delivery_score: "",
    price_score: "",
    communication_score: "",
    notes: "",
  };
}

export default function PerformancePage() {
  usePageTitle("Performance");
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canCreateAssessment = useHasRole("admin", "procurement_manager");
  const [activeTab, setActiveTab] = useState<"evaluations" | "new-assessment">("evaluations");
  const [form, setForm] = useState<AssessmentForm>(() => createEmptyAssessmentForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUnreviewed, setShowUnreviewed] = useState(false);

  const [sortKey, setSortKey] = useState<PerfTableSortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleColumnSort(key: PerfTableSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "supplier" || key === "period" ? "asc" : "desc");
    }
  }

  const performanceFilterDefaults = useMemo(
    () => ({
      period: [] as string[],
      metric: [] as string[],
      industry: [] as string[],
      suppliers: [] as string[],
    }),
    []
  );

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: performanceFilterDefaults,
    debounceKeys: [],
  });

  const selectedPeriods = (filters.period as string[]) ?? [];
  const selectedMetrics = (filters.metric as string[]) ?? [];
  const selectedIndustries = (filters.industry as string[]) ?? [];
  const selectedSuppliers = (filters.suppliers as string[]) ?? [];

  const activeMetric: MetricFilter =
    selectedMetrics.length === 1 ? (selectedMetrics[0] as MetricFilter) : "overall";

  const {
    data: perfData,
    isFetching,
    error: perfQueryError,
  } = useQuery({
    queryKey: queryKeys.performance({}),
    queryFn: fetchPerformanceSummary,
    placeholderData: keepPreviousData,
  });

  const rows = perfData?.data ?? [];

  const error =
    perfQueryError instanceof Error
      ? perfQueryError.message
      : perfQueryError
        ? String(perfQueryError)
        : null;

  const { data: suppliersResult } = useQuery({
    queryKey: queryKeys.performanceSuppliers(),
    queryFn: fetchPerformanceSuppliers,
    enabled: canCreateAssessment,
  });

  const suppliers = suppliersResult?.data ?? [];

  const periodOptions = useMemo(() => {
    const quarters = [...new Set(rows.map((r) => r.evaluation_period))]
      .filter(Boolean)
      .sort()
      .reverse();

    const years = [...new Set(quarters.map((q) => q.split("-")[0]))].sort().reverse();

    type PeriodOption = { value: string; label: string; isYear: boolean };
    const options: PeriodOption[] = [{ value: "all", label: "All Periods", isYear: false }];

    years.forEach((year) => {
      options.push({ value: year, label: year, isYear: true });
      quarters
        .filter((q) => q.startsWith(year + "-"))
        .forEach((q) => options.push({ value: q, label: q, isYear: false }));
    });

    return options;
  }, [rows]);

  const industryOptions = useMemo(() => {
    const industries = [...new Set(rows.map((r) => getRowIndustry(r)).filter(Boolean) as string[])];
    return ["all", ...industries.sort()];
  }, [rows]);

  const supplierOptions = useMemo(() => {
    return [...new Set(rows.map((r) => getSupplierDisplayName(r)))].sort();
  }, [rows]);

  const filterFields: FilterFieldConfig[] = [
    {
      key: "period",
      type: "multiselect",
      placeholder: "All periods",
      options: periodOptions
        .map((o) => ({ value: o.value, label: o.label }))
        .filter((o) => o.value !== "all"),
      minWidth: "140px",
    },
    {
      key: "metric",
      type: "multiselect",
      placeholder: "All metrics",
      options: [
        { value: "overall", label: "Overall" },
        { value: "quality", label: "Quality" },
        { value: "delivery", label: "Delivery" },
        { value: "price", label: "Price" },
        { value: "communication", label: "Communication" },
      ],
      minWidth: "150px",
    },
    {
      key: "industry",
      type: "multiselect",
      placeholder: "All industries",
      options: industryOptions
        .filter((i) => i !== "all")
        .map((i) => ({ value: i, label: i })),
      minWidth: "150px",
    },
    {
      key: "suppliers",
      type: "multiselect",
      placeholder: "All suppliers",
      options: supplierOptions.map((name) => ({ value: name, label: name })),
      minWidth: "160px",
    },
  ];

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const matchPeriod =
        selectedPeriods.length === 0 ||
        selectedPeriods.some(
          (p) => r.evaluation_period === p || r.evaluation_period.startsWith(p + "-")
        );
      const industry = getRowIndustry(r);
      const matchIndustry =
        selectedIndustries.length === 0 || selectedIndustries.includes(industry ?? "");
      const displayName = getSupplierDisplayName(r);
      const matchSupplier =
        selectedSuppliers.length === 0 || selectedSuppliers.includes(displayName);
      const matchMetric = true;
      return matchPeriod && matchIndustry && matchSupplier && matchMetric;
    });

    const colMap: Record<
      Exclude<PerfTableSortKey, "supplier" | "period">,
      keyof PerformanceSummaryRow
    > = {
      overall: "overall_score",
      quality: "quality_score",
      delivery: "delivery_score",
      price: "price_score",
      communication: "communication_score",
    };

    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "supplier") {
        return dir * getSupplierDisplayName(a).localeCompare(getSupplierDisplayName(b));
      }
      if (sortKey === "period") {
        return dir * a.evaluation_period.localeCompare(b.evaluation_period);
      }
      const field = colMap[sortKey];
      const ak = (a[field] as number) ?? 0;
      const bk = (b[field] as number) ?? 0;
      return dir * (ak - bk);
    });
  }, [rows, selectedPeriods, selectedIndustries, selectedSuppliers, sortKey, sortDir]);

  const suppliersInChart = useMemo(() => {
    if (selectedSuppliers.length > 0) return selectedSuppliers;
    return supplierOptions.slice(0, 5);
  }, [selectedSuppliers, supplierOptions]);

  const radarData = useMemo(() => {
    if (!filteredRows.length || !suppliersInChart.length) return [];
    const metrics: { key: keyof PerformanceSummaryRow; label: string }[] = [
      { key: "overall_score", label: "Overall" },
      { key: "quality_score", label: "Quality" },
      { key: "delivery_score", label: "Delivery" },
      { key: "price_score", label: "Price" },
      { key: "communication_score", label: "Communication" },
    ];
    return metrics.map(({ key, label }) => {
      const entry: Record<string, string | number> = { metric: label };
      suppliersInChart.forEach((supplierName) => {
        const supplierRows = filteredRows.filter((r) => getSupplierDisplayName(r) === supplierName);
        if (supplierRows.length > 0) {
          const raw = supplierRows.reduce((sum, row) => sum + (row[key] as number), 0) / supplierRows.length;
          entry[supplierName] = parseFloat(raw.toFixed(2));
        } else {
          entry[supplierName] = 0;
        }
      });
      return entry;
    });
  }, [filteredRows, suppliersInChart]);

  const lineData = useMemo(() => {
    const quarters = [...new Set(filteredRows.map((r) => r.evaluation_period))].sort();
    return quarters.map((quarter) => {
      const entry: Record<string, string | number> = { quarter };
      suppliersInChart.forEach((supplierName) => {
        const supplierQuarterRows = filteredRows.filter(
          (r) => getSupplierDisplayName(r) === supplierName && r.evaluation_period === quarter
        );
        if (supplierQuarterRows.length > 0) {
          const avg =
            supplierQuarterRows.reduce((sum, r) => sum + getMetricScore(r, activeMetric), 0) /
            supplierQuarterRows.length;
          entry[supplierName] = parseFloat(avg.toFixed(2));
        }
      });
      return entry;
    });
  }, [filteredRows, suppliersInChart, activeMetric]);

  const kpis = useMemo(() => {
    if (!filteredRows.length) return null;
    const scores = filteredRows.map((r) => getMetricScore(r, activeMetric));
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    const best = filteredRows.reduce((a, b) =>
      getMetricScore(a, activeMetric) > getMetricScore(b, activeMetric) ? a : b
    );
    const worst = filteredRows.reduce((a, b) =>
      getMetricScore(a, activeMetric) < getMetricScore(b, activeMetric) ? a : b
    );
    return {
      avg,
      bestName: getSupplierDisplayName(best),
      worstName: getSupplierDisplayName(worst),
      total: filteredRows.length,
    };
  }, [filteredRows, activeMetric]);

  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const currentQuarter = monthToQuarter(currentYearMonth);

  const unreviewedSuppliers = useMemo(() => {
    if (!suppliers.length) return [];
    const reviewedIds = new Set(
      rows.filter((r) => r.evaluation_period === currentQuarter).map((r) => r.supplier_id)
    );
    return suppliers.filter((s) => !reviewedIds.has(s.id));
  }, [suppliers, rows, currentQuarter]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);

    if (!form.supplier_id) {
      setSubmitError("Please select a supplier.");
      return;
    }
    if (!form.evaluation_month) {
      setSubmitError("Please select an evaluation period.");
      return;
    }

    const scores = {
      quality_score: parseFloat(form.quality_score),
      delivery_score: parseFloat(form.delivery_score),
      price_score: parseFloat(form.price_score),
      communication_score: parseFloat(form.communication_score),
    };

    for (const [key, val] of Object.entries(scores)) {
      if (Number.isNaN(val) || val < 0 || val > 10) {
        const label = key.replace("_score", "");
        setSubmitError(`${label} score must be between 0 and 10.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await apiPost(`/api/suppliers/${form.supplier_id}/evaluations`, {
        ...scores,
        evaluation_period: monthToQuarter(form.evaluation_month),
        notes: form.notes.trim() || undefined,
        evaluated_by: profile?.id,
      });
      setForm(createEmptyAssessmentForm());
      await queryClient.invalidateQueries({ queryKey: queryKeys.performance({}) });
      setActiveTab("evaluations");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  }, [form, profile?.id, queryClient]);

  if (rows.length === 0 && isFetching) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-surface-900">Performance</h1>
            <p className="text-sm text-surface-500">Supplier evaluation management</p>
          </div>
        </div>
        {canCreateAssessment && (
          <button
            type="button"
            onClick={() => setActiveTab("new-assessment")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> New Assessment
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("evaluations")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "evaluations"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Evaluations
        </button>
        {canCreateAssessment && (
          <button
            type="button"
            onClick={() => setActiveTab("new-assessment")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "new-assessment"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            New Assessment
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {activeTab === "evaluations" &&
        (rows.length === 0 ? (
          <p className="text-sm text-surface-500">No evaluations yet</p>
        ) : (
          <>
            {kpis && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {(
                  [
                    {
                      label: METRIC_KPI_LABELS[activeMetric],
                      value: parseFloat(kpis.avg),
                      max: 10,
                      color: "#0369a1",
                    },
                    {
                      label: "Best Performer",
                      value: getMetricScore(
                        filteredRows.reduce((a, b) =>
                          getMetricScore(a, activeMetric) > getMetricScore(b, activeMetric) ? a : b
                        ),
                        activeMetric
                      ),
                      max: 10,
                      color: "#16a34a",
                      subtitle: kpis.bestName,
                    },
                    {
                      label: "Worst Performer",
                      value: getMetricScore(
                        filteredRows.reduce((a, b) =>
                          getMetricScore(a, activeMetric) < getMetricScore(b, activeMetric) ? a : b
                        ),
                        activeMetric
                      ),
                      max: 10,
                      color: "#dc2626",
                      subtitle: kpis.worstName,
                    },
                    {
                      label: "Total Evaluations",
                      value: kpis.total,
                      max: null,
                      color: "#7c3aed",
                    },
                  ] as PerfEvalKpiCard[]
                ).map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4"
                  >
                    {kpi.max !== null ? (
                      <ESGScoreRing
                        score={kpi.value}
                        size={64}
                        strokeWidth={7}
                        color={kpi.color}
                        maxScore={kpi.max}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                        style={{ backgroundColor: kpi.color }}
                      >
                        {kpi.value}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-surface-500">{kpi.label}</p>
                      {kpi.max !== null && (
                        <p className="text-2xl font-bold text-surface-900">{kpi.value.toFixed(2)}</p>
                      )}
                      {"subtitle" in kpi && kpi.subtitle ? (
                        <p className="text-sm font-medium text-surface-700 truncate" title={kpi.subtitle}>
                          {kpi.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(radarData.length > 0 || lineData.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-surface-200 p-6">
                  <h3 className="text-sm font-semibold text-surface-900 mb-1">Supplier Comparison</h3>
                  <p className="text-xs text-surface-400 mb-4">Average scores by metric · scale 0–10</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fontSize: 12, fill: "#6b7280", fontWeight: 500 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickCount={6}
                      />
                      {suppliersInChart.map((name, i) => (
                        <Radar
                          key={name}
                          name={name}
                          dataKey={name}
                          stroke={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                          fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      <Tooltip
                        formatter={(value: number | string) => [
                          typeof value === "number" ? value.toFixed(2) : value,
                          "",
                        ]}
                        contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-surface-200 p-6">
                  <h3 className="text-sm font-semibold text-surface-900 mb-1">Score Trend</h3>
                  <p className="text-xs text-surface-400 mb-4">
                    {METRIC_KPI_LABELS[activeMetric]} per supplier over time
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="quarter"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb" }}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={false}
                        tickCount={6}
                      />
                      <Tooltip
                        formatter={(value: number | string, name: string) => [
                          typeof value === "number" ? value.toFixed(2) : value,
                          name,
                        ]}
                        contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      {suppliersInChart.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4, fill: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length] }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div
              className={`mb-6 space-y-6 ${isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}`}
            >
              <FilterBar
                fields={filterFields}
                values={filters}
                onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
                onReset={resetFilters}
                activeCount={activeCount}
                resultCount={filteredRows.length}
                resultLabel="evaluations"
              />

            {filteredRows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No evaluations match the selected filters.
              </div>
            ) : (
              <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50/50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("supplier")}
                            className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-surface-700"
                          >
                            Supplier{" "}
                            {sortKey === "supplier" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("period")}
                            className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-surface-700"
                          >
                            Period{" "}
                            {sortKey === "period" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("overall")}
                            className="inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wider hover:text-surface-700 w-full"
                          >
                            Overall{" "}
                            {sortKey === "overall" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("quality")}
                            className="inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wider hover:text-surface-700 w-full"
                          >
                            Quality{" "}
                            {sortKey === "quality" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("delivery")}
                            className="inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wider hover:text-surface-700 w-full"
                          >
                            Delivery{" "}
                            {sortKey === "delivery" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("price")}
                            className="inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wider hover:text-surface-700 w-full"
                          >
                            Price{" "}
                            {sortKey === "price" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => toggleColumnSort("communication")}
                            className="inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wider hover:text-surface-700 w-full"
                          >
                            Communication{" "}
                            {sortKey === "communication" ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <motion.tbody
                      className="divide-y divide-surface-100"
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredRows.map((r) => (
                        <motion.tr key={r.id} variants={staggerItem} className="hover:bg-surface-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-medium text-surface-900">{getSupplierDisplayName(r)}</span>
                            <span className="ml-2 text-xs font-mono text-surface-400">{r.supplier_code}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-surface-900">{r.evaluation_period}</td>
                          <td className="px-5 py-3.5 text-right text-sm">
                            {typeof r.overall_score === "number" ? (
                              <div className="inline-flex flex-col gap-1 w-24 ml-auto text-left">
                                <span className={getScoreColor(r.overall_score)}>{r.overall_score.toFixed(2)}</span>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${getScoreBarColor(r.overall_score)}`}
                                    style={{ width: `${(r.overall_score / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={`px-5 py-3.5 text-right text-sm ${getScoreColor(r.quality_score)}`}>
                            {r.quality_score}
                          </td>
                          <td className={`px-5 py-3.5 text-right text-sm ${getScoreColor(r.delivery_score)}`}>
                            {r.delivery_score}
                          </td>
                          <td className={`px-5 py-3.5 text-right text-sm ${getScoreColor(r.price_score)}`}>
                            {r.price_score}
                          </td>
                          <td className={`px-5 py-3.5 text-right text-sm ${getScoreColor(r.communication_score)}`}>
                            {r.communication_score}
                          </td>
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
            )}
            </div>
          </>
        ))}

      {activeTab === "new-assessment" && canCreateAssessment && (
        <div className="max-w-2xl space-y-6">
          {unreviewedSuppliers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 text-sm font-medium">
                    ⚠️ {unreviewedSuppliers.length} supplier{unreviewedSuppliers.length > 1 ? "s" : ""} not yet
                    evaluated this quarter ({currentQuarter})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnreviewed((o) => !o)}
                  className="text-xs text-amber-600 underline hover:text-amber-800"
                >
                  {showUnreviewed ? "Hide" : "Show list"}
                </button>
              </div>
              {showUnreviewed && (
                <ul className="mt-3 space-y-1">
                  {unreviewedSuppliers.map((s) => (
                    <li
                      key={s.id}
                      className="text-sm text-amber-800 cursor-pointer hover:underline"
                      onClick={() => setForm((f) => ({ ...f, supplier_id: s.id }))}
                    >
                      → {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">New Performance Assessment</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Supplier
              </label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Evaluation Period
              </label>
              <input
                type="month"
                value={form.evaluation_month}
                onChange={(e) => setForm((f) => ({ ...f, evaluation_month: e.target.value }))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.evaluation_month && (
                <p className="mt-1 text-xs text-gray-400">
                  Will be saved as:{" "}
                  <span className="font-mono font-medium text-gray-600">
                    {monthToQuarter(form.evaluation_month)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Scores (0 – 10)
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["quality_score", "Quality"],
                    ["delivery_score", "Delivery"],
                    ["price_score", "Price"],
                    ["communication_score", "Communication"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="0.0"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Notes
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional evaluation notes..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
