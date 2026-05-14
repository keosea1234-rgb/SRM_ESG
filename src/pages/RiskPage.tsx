import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, ShieldAlert, Plus } from "lucide-react";
import { apiPost } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { fetchRiskSummary, fetchRiskSuppliers, type RiskSummaryRow } from "../services/risk";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { useAuth, useHasRole } from "../context/AuthContext";
import ESGScoreRing from "../components/ESGScoreRing";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";


const RISK_LEVEL_STYLES: Record<string, string> = {
  low: "bg-green-50 text-green-700 border border-green-200",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  high: "bg-red-50 text-red-700 border border-red-200",
  critical: "bg-red-100 text-red-800 border border-red-300 font-semibold",
};

const RISK_LEVEL_NUMERIC: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SUPPLIER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const style = RISK_LEVEL_STYLES[level.toLowerCase()] ?? "bg-surface-100 text-surface-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs capitalize ${style}`}>
      {level}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getSupplierName(r: RiskSummaryRow): string {
  const nested = r.srm_suppliers?.name;
  if (nested?.trim()) return nested;
  return r.supplier_id;
}

function getIndustry(r: RiskSummaryRow): string | null {
  const nested = r.srm_suppliers?.industry;
  if (nested?.trim()) return nested;
  return null;
}

function toMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiskPage() {
  usePageTitle("Risk");
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canCreateAssessment = useHasRole("admin", "procurement_manager");
  const [activeTab, setActiveTab] = useState<"assessments" | "new-assessment">("assessments");

  const emptyForm = {
    supplier_id: "",
    assessment_date: new Date().toISOString().slice(0, 10),
    financial_risk: "",
    operational_risk: "",
    compliance_risk: "",
    geopolitical_risk: "",
    reputational_risk: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUnreviewed, setShowUnreviewed] = useState(false);

  const riskFilterDefaults = useMemo(
    () => ({
      riskLevel: [] as string[],
      industry: [] as string[],
      suppliers: [] as string[],
    }),
    []
  );

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: riskFilterDefaults,
    debounceKeys: [],
  });

  const selectedRiskLevels = (filters.riskLevel as string[]) ?? [];
  const selectedIndustries = (filters.industry as string[]) ?? [];
  const selectedSuppliers = (filters.suppliers as string[]) ?? [];

  const {
    data: riskResult,
    isLoading: loading,
    error: riskQueryError,
  } = useQuery({
    queryKey: queryKeys.risk(),
    queryFn: fetchRiskSummary,
  });

  const rows = riskResult?.data ?? [];

  const error =
    riskQueryError instanceof Error
      ? riskQueryError.message
      : riskQueryError
        ? String(riskQueryError)
        : null;

  const { data: suppliersResult } = useQuery({
    queryKey: queryKeys.riskSuppliers(),
    queryFn: fetchRiskSuppliers,
    enabled: canCreateAssessment,
  });

  const suppliers = suppliersResult?.data ?? [];

  // ── Derived data ────────────────────────────────────────────────────────────

  const industryOptions = useMemo(() => {
    const list = [...new Set(rows.map(getIndustry).filter(Boolean) as string[])].sort();
    return ["all", ...list];
  }, [rows]);

  const supplierOptions = useMemo(() => {
    return [...new Set(rows.map(getSupplierName))].sort();
  }, [rows]);

  const filterFields: FilterFieldConfig[] = [
    {
      key: "riskLevel",
      type: "multiselect",
      placeholder: "All risk levels",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
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
    return rows.filter((r) => {
      const matchRisk =
        selectedRiskLevels.length === 0 ||
        selectedRiskLevels.includes(r.overall_risk_level.toLowerCase());
      const matchIndustry =
        selectedIndustries.length === 0 || selectedIndustries.includes(getIndustry(r) ?? "");
      const matchSupplier =
        selectedSuppliers.length === 0 || selectedSuppliers.includes(getSupplierName(r));
      return matchRisk && matchIndustry && matchSupplier;
    });
  }, [rows, selectedRiskLevels, selectedIndustries, selectedSuppliers]);

  const suppliersInChart = useMemo(() => {
    if (selectedSuppliers.length > 0) return selectedSuppliers;
    return supplierOptions.slice(0, 5);
  }, [selectedSuppliers, supplierOptions]);

  const radarData = useMemo(() => {
    if (!filteredRows.length || !suppliersInChart.length) return [];
    const metrics: { key: keyof RiskSummaryRow; label: string }[] = [
      { key: "financial_risk", label: "Financial" },
      { key: "operational_risk", label: "Operational" },
      { key: "compliance_risk", label: "Compliance" },
      { key: "geopolitical_risk", label: "Geopolitical" },
      { key: "reputational_risk", label: "Reputational" },
    ];
    return metrics.map(({ key, label }) => {
      const entry: Record<string, string | number> = { metric: label };
      suppliersInChart.forEach((supplierName) => {
        const supplierRows = filteredRows.filter((r) => getSupplierName(r) === supplierName);
        if (supplierRows.length > 0) {
          const raw =
            supplierRows.reduce((sum, row) => sum + (row[key] as number), 0) / supplierRows.length;
          entry[supplierName] = parseFloat(raw.toFixed(2));
        } else {
          entry[supplierName] = 0;
        }
      });
      return entry;
    });
  }, [filteredRows, suppliersInChart]);

  const lineData = useMemo(() => {
    const months = [...new Set(filteredRows.map((r) => toMonth(r.assessment_date)))].sort();
    return months.map((month) => {
      const entry: Record<string, string | number> = { month };
      suppliersInChart.forEach((supplierName) => {
        const monthRows = filteredRows.filter(
          (r) => getSupplierName(r) === supplierName && toMonth(r.assessment_date) === month
        );
        if (monthRows.length > 0) {
          const avg =
            monthRows.reduce(
              (sum, r) => sum + (RISK_LEVEL_NUMERIC[r.overall_risk_level.toLowerCase()] ?? 0),
              0
            ) / monthRows.length;
          entry[supplierName] = parseFloat(avg.toFixed(2));
        }
      });
      return entry;
    });
  }, [filteredRows, suppliersInChart]);

  const kpis = useMemo(() => {
    if (!filteredRows.length) return null;
    const avg = (key: keyof RiskSummaryRow) =>
      filteredRows.reduce((s, r) => s + (r[key] as number), 0) / filteredRows.length;
    const criticalCount = filteredRows.filter((r) => r.overall_risk_level.toLowerCase() === "critical").length;
    return {
      avgFinancial: avg("financial_risk").toFixed(2),
      avgOperational: avg("operational_risk").toFixed(2),
      avgCompliance: avg("compliance_risk").toFixed(2),
      criticalCount,
      total: filteredRows.length,
    };
  }, [filteredRows]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const unreviewedSuppliers = useMemo(() => {
    if (!suppliers.length) return [];
    const reviewedIds = new Set(
      rows.filter((r) => toMonth(r.assessment_date) === currentMonth).map((r) => r.supplier_id)
    );
    return suppliers.filter((s) => !reviewedIds.has(s.id));
  }, [suppliers, rows, currentMonth]);

  async function handleSubmit() {
    setSubmitError(null);
    if (!form.supplier_id) {
      setSubmitError("Please select a supplier.");
      return;
    }
    if (!form.assessment_date) {
      setSubmitError("Please select a date.");
      return;
    }

    const scores = {
      financial_risk: parseInt(form.financial_risk, 10),
      operational_risk: parseInt(form.operational_risk, 10),
      compliance_risk: parseInt(form.compliance_risk, 10),
      geopolitical_risk: parseInt(form.geopolitical_risk, 10),
      reputational_risk: parseInt(form.reputational_risk, 10),
    };

    for (const [key, val] of Object.entries(scores)) {
      if (Number.isNaN(val) || val < 1 || val > 5) {
        const label = key.replace("_risk", "");
        setSubmitError(`${label} risk must be between 1 and 5.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await apiPost(`/api/suppliers/${form.supplier_id}/assessments`, {
        ...scores,
        assessment_date: form.assessment_date,
        notes: form.notes || undefined,
        assessed_by: profile?.id,
      });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["risk"] });
      setActiveTab("assessments");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-surface-900">Risk Management</h1>
            <p className="text-sm text-surface-500">Supplier risk assessment management</p>
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("assessments")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "assessments"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Assessments
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

      {activeTab === "assessments" && (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-surface-500">No assessments yet</p>
          ) : (
            <>
              {kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      {
                        label: "Avg Financial Risk",
                        value: parseFloat(kpis.avgFinancial),
                        color: "#ef4444",
                        maxScore: 5,
                      },
                      {
                        label: "Avg Operational Risk",
                        value: parseFloat(kpis.avgOperational),
                        color: "#f59e0b",
                        maxScore: 5,
                      },
                      {
                        label: "Avg Compliance Risk",
                        value: parseFloat(kpis.avgCompliance),
                        color: "#8b5cf6",
                        maxScore: 5,
                      },
                      {
                        label: "Critical Suppliers",
                        value: kpis.criticalCount,
                        color: "#dc2626",
                        maxScore: null,
                      },
                    ] as { label: string; value: number; color: string; maxScore: number | null }[]
                  ).map((kpi) => (
                    <div
                      key={kpi.label}
                      className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4"
                    >
                      {kpi.maxScore !== null ? (
                        <ESGScoreRing
                          score={kpi.value}
                          size={64}
                          strokeWidth={7}
                          color={kpi.color}
                          maxScore={kpi.maxScore}
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
                        {kpi.maxScore !== null && (
                          <p className="text-2xl font-bold text-surface-900">{kpi.value.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(radarData.length > 0 || lineData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-surface-200 p-6">
                    <h3 className="text-sm font-semibold text-surface-900 mb-1">Risk Profile Comparison</h3>
                    <p className="text-xs text-surface-400 mb-4">Average risk scores by category · scale 1–5</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fontSize: 12, fill: "#6b7280", fontWeight: 500 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 5]}
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
                          formatter={(v: number | string) => [
                            typeof v === "number" ? v.toFixed(2) : v,
                            "",
                          ]}
                          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-surface-200 p-6">
                    <h3 className="text-sm font-semibold text-surface-900 mb-1">Risk Level Trend</h3>
                    <p className="text-xs text-surface-400 mb-4">
                      Overall risk level per supplier over time (1=low · 2=medium · 3=high · 4=critical)
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          tickLine={false}
                          axisLine={{ stroke: "#e5e7eb" }}
                        />
                        <YAxis
                          domain={[0, 4]}
                          ticks={[1, 2, 3, 4]}
                          tickFormatter={(v: number) =>
                            (["", "Low", "Medium", "High", "Critical"] as const)[Math.round(v)] ?? ""
                          }
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          tickLine={false}
                          axisLine={false}
                          width={60}
                        />
                        <Tooltip
                          formatter={(v: number | string, name: string) => {
                            const labels: Record<number, string> = {
                              1: "Low",
                              2: "Medium",
                              3: "High",
                              4: "Critical",
                            };
                            return [
                              typeof v === "number" ? (labels[Math.round(v)] ?? v.toFixed(2)) : v,
                              name,
                            ];
                          }}
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

              <div className="mb-6">
                <FilterBar
                  fields={filterFields}
                  values={filters}
                  onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
                  onReset={resetFilters}
                  activeCount={activeCount}
                  resultCount={filteredRows.length}
                  resultLabel="assessments"
                />
              </div>

              {filteredRows.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No assessments match the selected filters.
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50/50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Supplier
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Risk Level
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Financial
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Operational
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Compliance
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Geopolitical
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                          Reputational
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
                            <span className="text-sm font-medium text-surface-900">{getSupplierName(r)}</span>
                            <span className="ml-2 text-xs font-mono text-surface-400">{r.supplier_code}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-surface-600">{formatDate(r.assessment_date)}</td>
                          <td className="px-5 py-3.5">
                            <RiskBadge level={r.overall_risk_level} />
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-surface-600">{r.financial_risk}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-surface-600">{r.operational_risk}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-surface-600">{r.compliance_risk}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-surface-600">{r.geopolitical_risk}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-surface-600">{r.reputational_risk}</td>
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === "new-assessment" && canCreateAssessment && (
        <div className="max-w-2xl space-y-6">
          {unreviewedSuppliers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-amber-600 text-sm font-medium">
                  ⚠️ {unreviewedSuppliers.length} supplier{unreviewedSuppliers.length > 1 ? "s" : ""} not yet
                  assessed this month ({currentMonth})
                </span>
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
            <h2 className="text-base font-semibold text-gray-800">New Risk Assessment</h2>

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
                Assessment Date
              </label>
              <input
                type="date"
                value={form.assessment_date}
                onChange={(e) => setForm((f) => ({ ...f, assessment_date: e.target.value }))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Risk Scores (1 = lowest · 5 = highest)
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["financial_risk", "Financial"],
                    ["operational_risk", "Operational"],
                    ["compliance_risk", "Compliance"],
                    ["geopolitical_risk", "Geopolitical"],
                    ["reputational_risk", "Reputational"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="1–5"
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
                placeholder="Optional assessment notes..."
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
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
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
