import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Gauge,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiPost } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { fetchRiskSummary, fetchRiskSuppliers, type RiskSummaryRow } from "../services/risk";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { useAuth, useHasRole } from "../context/AuthContext";
import { findWgiPoliticalStabilityRisk, type WgiRiskFactorMatch } from "../lib/riskFactorUpload";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import { usePageTitle } from "../hooks/usePageTitle";

const RISK_DIMENSIONS = [
  { key: "financial_risk", label: "Financial", appetite: 2.7 },
  { key: "operational_risk", label: "Operational", appetite: 2.8 },
  { key: "compliance_risk", label: "Compliance", appetite: 2.4 },
  { key: "geopolitical_risk", label: "Geopolitical", appetite: 2.9 },
  { key: "reputational_risk", label: "Reputational", appetite: 2.5 },
] as const;

const LEVEL_META: Record<string, { label: string; score: number; color: string; soft: string; badge: string }> = {
  low: {
    label: "Low",
    score: 1,
    color: "#10b981",
    soft: "bg-emerald-50 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  medium: {
    label: "Medium",
    score: 2,
    color: "#f59e0b",
    soft: "bg-amber-50 text-amber-800",
    badge: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  high: {
    label: "High",
    score: 3,
    color: "#f97316",
    soft: "bg-orange-50 text-orange-800",
    badge: "bg-orange-50 text-orange-800 border border-orange-200",
  },
  critical: {
    label: "Critical",
    score: 4,
    color: "#dc2626",
    soft: "bg-red-50 text-red-700",
    badge: "bg-red-50 text-red-800 border border-red-200 font-semibold",
  },
};

const SUPPLIER_COLORS = ["#006fa0", "#1bcdaa", "#f59e0b", "#7c3aed", "#ef4444", "#0891b2"];
const APPETITE_THRESHOLD = 2.8;
const WGI_DOWNLOAD_URL =
  "https://api.worldbank.org/v2/country/all/indicator/PV.PER.RNK?downloadformat=csv";

function RiskBadge({ level }: { level: string }) {
  const meta = LEVEL_META[level.toLowerCase()] ?? LEVEL_META.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs capitalize ${meta.badge}`}>
      {level}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getSupplierName(r: RiskSummaryRow): string {
  const nested = r.srm_suppliers?.name;
  if (nested?.trim()) return nested;
  return r.supplier_id;
}

function getIndustry(r: RiskSummaryRow): string {
  const nested = r.srm_suppliers?.industry;
  if (nested?.trim()) return nested;
  return "Unclassified";
}

function toMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function riskScore(row: RiskSummaryRow): number {
  return RISK_DIMENSIONS.reduce((sum, dim) => sum + Number(row[dim.key]), 0) / RISK_DIMENSIONS.length;
}

function levelScore(level: string): number {
  return LEVEL_META[level.toLowerCase()]?.score ?? 2;
}

function scoreTone(score: number): string {
  if (score >= 4) return "text-red-700";
  if (score >= 3) return "text-orange-700";
  if (score >= 2) return "text-amber-700";
  return "text-emerald-700";
}

function heatCell(score: number | null): string {
  if (score == null) return "bg-surface-50 text-surface-300";
  if (score >= 4) return "bg-red-100 text-red-800";
  if (score >= 3) return "bg-orange-100 text-orange-800";
  if (score >= 2) return "bg-amber-50 text-amber-800";
  return "bg-emerald-50 text-emerald-800";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  delta,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShieldAlert;
  tone: "blue" | "green" | "amber" | "red";
  delta?: "up" | "down" | "flat";
}) {
  const tones = {
    blue: "bg-brand-50 text-brand-700 border-brand-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  const DeltaIcon = delta === "up" ? ArrowUpRight : delta === "down" ? ArrowDownRight : CircleDot;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta && <DeltaIcon className={`w-4 h-4 ${delta === "up" ? "text-red-500" : delta === "down" ? "text-emerald-500" : "text-surface-400"}`} />}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
      <p className="mt-1 text-xs text-surface-500">{detail}</p>
    </div>
  );
}

export default function RiskPage() {
  usePageTitle("Risk");
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canCreateAssessment = useHasRole("admin", "procurement_manager");
  const [activeTab, setActiveTab] = useState<"dashboard" | "new-assessment">("dashboard");

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
  const [riskFactorMatch, setRiskFactorMatch] = useState<WgiRiskFactorMatch | null>(null);
  const [riskFactorError, setRiskFactorError] = useState<string | null>(null);
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
  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id) ?? null;

  const latestRows = useMemo(() => {
    const bySupplier = new Map<string, RiskSummaryRow>();
    [...rows]
      .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
      .forEach((row) => {
        if (!bySupplier.has(row.supplier_id)) bySupplier.set(row.supplier_id, row);
      });
    return [...bySupplier.values()];
  }, [rows]);

  const industryOptions = useMemo(() => {
    return [...new Set(latestRows.map(getIndustry))].sort();
  }, [latestRows]);

  const supplierOptions = useMemo(() => {
    return [...new Set(latestRows.map(getSupplierName))].sort();
  }, [latestRows]);

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
      options: industryOptions.map((i) => ({ value: i, label: i })),
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
    return latestRows.filter((r) => {
      const matchRisk =
        selectedRiskLevels.length === 0 ||
        selectedRiskLevels.includes(r.overall_risk_level.toLowerCase());
      const matchIndustry =
        selectedIndustries.length === 0 || selectedIndustries.includes(getIndustry(r));
      const matchSupplier =
        selectedSuppliers.length === 0 || selectedSuppliers.includes(getSupplierName(r));
      return matchRisk && matchIndustry && matchSupplier;
    });
  }, [latestRows, selectedRiskLevels, selectedIndustries, selectedSuppliers]);

  const filteredHistory = useMemo(() => {
    const supplierIds = new Set(filteredRows.map((r) => r.supplier_id));
    return rows.filter((r) => supplierIds.has(r.supplier_id));
  }, [rows, filteredRows]);

  const metrics = useMemo(() => {
    if (!filteredRows.length) return null;
    const exposure = filteredRows.reduce((sum, row) => sum + riskScore(row), 0) / filteredRows.length;
    const breaches = filteredRows.filter((r) => riskScore(r) > APPETITE_THRESHOLD || levelScore(r.overall_risk_level) >= 3);
    const critical = filteredRows.filter((r) => r.overall_risk_level.toLowerCase() === "critical");
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 90);
    const stale = filteredRows.filter((r) => new Date(r.assessment_date) < staleCutoff);
    const concentration = filteredRows
      .map((row) => Math.max(0, riskScore(row) - 1))
      .sort((a, b) => b - a);
    const totalWeight = concentration.reduce((sum, val) => sum + val, 0);
    const topFiveWeight = concentration.slice(0, 5).reduce((sum, val) => sum + val, 0);

    return {
      exposure,
      breaches: breaches.length,
      critical: critical.length,
      stale: stale.length,
      concentration: totalWeight ? (topFiveWeight / totalWeight) * 100 : 0,
      total: filteredRows.length,
    };
  }, [filteredRows]);

  const monthlyTrend = useMemo(() => {
    const grouped = new Map<string, { sum: number; count: number; critical: number; high: number }>();
    filteredHistory.forEach((row) => {
      const month = toMonth(row.assessment_date);
      const entry = grouped.get(month) ?? { sum: 0, count: 0, critical: 0, high: 0 };
      entry.sum += riskScore(row);
      entry.count += 1;
      if (row.overall_risk_level.toLowerCase() === "critical") entry.critical += 1;
      if (row.overall_risk_level.toLowerCase() === "high") entry.high += 1;
      grouped.set(month, entry);
    });
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, entry]) => ({
        month,
        exposure: Number((entry.sum / entry.count).toFixed(2)),
        severe: entry.high + entry.critical,
      }));
  }, [filteredHistory]);

  const levelDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    filteredRows.forEach((row) => {
      const level = row.overall_risk_level.toLowerCase() as keyof typeof counts;
      if (level in counts) counts[level] += 1;
    });
    return Object.entries(counts).map(([level, count]) => ({
      level: LEVEL_META[level].label,
      count,
      color: LEVEL_META[level].color,
    }));
  }, [filteredRows]);

  const categoryBars = useMemo(() => {
    return RISK_DIMENSIONS.map((dim) => {
      const score = filteredRows.length
        ? filteredRows.reduce((sum, row) => sum + Number(row[dim.key]), 0) / filteredRows.length
        : 0;
      return {
        category: dim.label,
        score: Number(score.toFixed(2)),
        appetite: dim.appetite,
      };
    });
  }, [filteredRows]);

  const heatmap = useMemo(() => {
    const industries = [...new Set(filteredRows.map(getIndustry))].sort();
    const lookup = new Map<string, number>();
    industries.forEach((industry) => {
      RISK_DIMENSIONS.forEach((dim) => {
        const matching = filteredRows.filter((row) => getIndustry(row) === industry);
        if (!matching.length) return;
        const avg = matching.reduce((sum, row) => sum + Number(row[dim.key]), 0) / matching.length;
        lookup.set(`${industry}||${dim.label}`, Number(avg.toFixed(1)));
      });
    });
    return { industries: industries.slice(0, 8), lookup };
  }, [filteredRows]);

  const topRisks = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => riskScore(b) - riskScore(a))
      .slice(0, 8)
      .map((row) => {
        const driver = RISK_DIMENSIONS.reduce((max, dim) => {
          const value = Number(row[dim.key]);
          return value > max.value ? { label: dim.label, value } : max;
        }, { label: "Financial", value: 0 });
        return {
          row,
          score: Number(riskScore(row).toFixed(2)),
          driver,
        };
      });
  }, [filteredRows]);

  const suppliersInChart = useMemo(() => {
    if (selectedSuppliers.length > 0) return selectedSuppliers;
    return topRisks.slice(0, 5).map((risk) => getSupplierName(risk.row));
  }, [selectedSuppliers, topRisks]);

  const radarData = useMemo(() => {
    if (!filteredRows.length || !suppliersInChart.length) return [];
    return RISK_DIMENSIONS.map((dim) => {
      const entry: Record<string, string | number> = { metric: dim.label };
      suppliersInChart.forEach((supplierName) => {
        const supplierRows = filteredRows.filter((r) => getSupplierName(r) === supplierName);
        entry[supplierName] = supplierRows.length
          ? Number(
              (
                supplierRows.reduce((sum, row) => sum + Number(row[dim.key]), 0) /
                supplierRows.length
              ).toFixed(2)
            )
          : 0;
      });
      return entry;
    });
  }, [filteredRows, suppliersInChart]);

  const kriCards = useMemo(() => {
    const severePct = metrics?.total ? Math.round(((metrics.breaches + metrics.critical) / metrics.total) * 100) : 0;
    const stalePct = metrics?.total ? Math.round((metrics.stale / metrics.total) * 100) : 0;
    const avgCompliance = categoryBars.find((c) => c.category === "Compliance")?.score ?? 0;
    return [
      { label: "Appetite breaches", value: severePct, threshold: 18, tone: severePct > 18 ? "red" : "green" },
      { label: "Assessment staleness", value: stalePct, threshold: 12, tone: stalePct > 12 ? "amber" : "green" },
      { label: "Compliance KRI", value: Math.round((avgCompliance / 5) * 100), threshold: 48, tone: avgCompliance > 2.4 ? "red" : "green" },
    ];
  }, [categoryBars, metrics]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const unreviewedSuppliers = useMemo(() => {
    if (!suppliers.length) return [];
    const reviewedIds = new Set(
      rows.filter((r) => toMonth(r.assessment_date) === currentMonth).map((r) => r.supplier_id)
    );
    return suppliers.filter((s) => !reviewedIds.has(s.id));
  }, [suppliers, rows, currentMonth]);

  async function handleRiskFactorUpload(file: File | null) {
    setRiskFactorError(null);
    setRiskFactorMatch(null);

    if (!file) return;
    if (!form.supplier_id) {
      setRiskFactorError("Select a supplier first so we can match the CSV by supplier country.");
      return;
    }

    const country = selectedSupplier?.country;
    if (!country) {
      setRiskFactorError("Selected supplier does not have a country value.");
      return;
    }

    try {
      const text = await file.text();
      const match = findWgiPoliticalStabilityRisk(text, country);
      if (!match) {
        setRiskFactorError(`No PV.PER.RNK row found for ${country}. Try matching by ISO3 country code in supplier data.`);
        return;
      }

      setRiskFactorMatch(match);
      setForm((f) => ({
        ...f,
        geopolitical_risk: String(match.geopoliticalRisk),
        notes: [
          f.notes,
          `Geopolitical risk derived from World Bank WGI ${match.indicatorCode} (${match.countryName}, ${match.year}, percentile ${match.percentile}).`,
        ]
          .filter(Boolean)
          .join("\n"),
      }));
    } catch (e) {
      setRiskFactorError(e instanceof Error ? e.message : "Failed to read CSV file.");
    }
  }

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
      await apiPost(`/api/risk/suppliers/${form.supplier_id}/assessments`, {
        ...scores,
        assessment_date: form.assessment_date,
        notes: form.notes || undefined,
        assessed_by: profile?.id,
      });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["risk"] });
      setActiveTab("dashboard");
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-surface-900">Enterprise Risk Management</h1>
            <p className="text-sm text-surface-500">Board-level supplier exposure, appetite, KRIs, and mitigation flow</p>
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
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dashboard"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Risk Cockpit
        </button>
        {canCreateAssessment && (
          <button
            type="button"
            onClick={() => setActiveTab("new-assessment")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "new-assessment"
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            New Assessment
          </button>
        )}
      </div>

      {activeTab === "dashboard" && (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-surface-500">No assessments yet</p>
          ) : (
            <>
              <FilterBar
                fields={filterFields}
                values={filters}
                onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
                onReset={resetFilters}
                activeCount={activeCount}
                resultCount={filteredRows.length}
                resultLabel="suppliers"
              />

              {metrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <MetricCard
                    label="Portfolio exposure"
                    value={metrics.exposure.toFixed(2)}
                    detail={`Appetite ${APPETITE_THRESHOLD.toFixed(1)} on 1-5 scale`}
                    icon={Gauge}
                    tone={metrics.exposure > APPETITE_THRESHOLD ? "red" : "green"}
                    delta={monthlyTrend.length > 1 && monthlyTrend.at(-1)!.exposure > monthlyTrend.at(-2)!.exposure ? "up" : "down"}
                  />
                  <MetricCard
                    label="Appetite breaches"
                    value={String(metrics.breaches)}
                    detail={`${Math.round((metrics.breaches / metrics.total) * 100)}% of monitored suppliers`}
                    icon={Target}
                    tone={metrics.breaches > 0 ? "amber" : "green"}
                    delta={metrics.breaches > 0 ? "up" : "flat"}
                  />
                  <MetricCard
                    label="Critical suppliers"
                    value={String(metrics.critical)}
                    detail="Immediate executive attention"
                    icon={AlertTriangle}
                    tone={metrics.critical > 0 ? "red" : "green"}
                    delta={metrics.critical > 0 ? "up" : "flat"}
                  />
                  <MetricCard
                    label="Top-5 concentration"
                    value={`${Math.round(metrics.concentration)}%`}
                    detail={`${metrics.stale} assessments older than 90 days`}
                    icon={BarChart3}
                    tone={metrics.concentration > 55 ? "amber" : "blue"}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="card p-5 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-surface-900">Risk Appetite Monitor</h2>
                      <p className="text-xs text-surface-500">Monthly residual exposure and severe supplier count</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      <TrendingUp className="w-3.5 h-3.5" />
                      12-month view
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={310}>
                    <AreaChart data={monthlyTrend} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="exposureFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#006fa0" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#006fa0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf1f5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7689" }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 11, fill: "#6b7689" }} tickLine={false} axisLine={false} width={34} />
                      <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7689" }} tickLine={false} axisLine={false} width={34} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e4e7ec" }} />
                      <ReferenceLine yAxisId="left" y={APPETITE_THRESHOLD} stroke="#dc2626" strokeDasharray="5 5" label={{ value: "Appetite", fontSize: 11, fill: "#dc2626" }} />
                      <Area yAxisId="left" type="monotone" dataKey="exposure" name="Exposure" stroke="#006fa0" strokeWidth={2.5} fill="url(#exposureFill)" />
                      <Line yAxisId="right" type="monotone" dataKey="severe" name="High/Critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-surface-900 mb-1">Residual Risk Mix</h2>
                  <p className="text-xs text-surface-500 mb-4">Latest supplier risk level distribution</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={levelDistribution} dataKey="count" nameKey="level" innerRadius={62} outerRadius={92} paddingAngle={3}>
                        {levelDistribution.map((entry) => (
                          <Cell key={entry.level} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e4e7ec" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2">
                    {levelDistribution.map((entry) => (
                      <div key={entry.level} className="rounded-lg border border-surface-100 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs text-surface-500">{entry.level}</span>
                        </div>
                        <p className="mt-1 text-lg font-semibold text-surface-900">{entry.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="card p-5 xl:col-span-3">
                  <h2 className="text-sm font-semibold text-surface-900 mb-1">Category Exposure vs Appetite</h2>
                  <p className="text-xs text-surface-500 mb-4">Average dimension scores with tolerance reference</p>
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={categoryBars} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf1f5" />
                      <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#6b7689" }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#6b7689" }} tickLine={false} axisLine={false} width={30} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e4e7ec" }} />
                      <Bar dataKey="score" name="Average score" radius={[6, 6, 0, 0]} fill="#006fa0" />
                      <Line type="monotone" dataKey="appetite" name="Appetite" stroke="#dc2626" strokeWidth={2} dot={false} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-5 xl:col-span-2">
                  <h2 className="text-sm font-semibold text-surface-900 mb-1">KRI Thresholds</h2>
                  <p className="text-xs text-surface-500 mb-5">Traffic-light view aligned to appetite</p>
                  <div className="space-y-5">
                    {kriCards.map((kri) => (
                      <div key={kri.label} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-surface-700">{kri.label}</span>
                          <span className={`text-sm font-semibold ${kri.tone === "red" ? "text-red-700" : kri.tone === "amber" ? "text-amber-700" : "text-emerald-700"}`}>
                            {kri.value}%
                          </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-surface-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${kri.tone === "red" ? "bg-red-500" : kri.tone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(kri.value, 100)}%` }}
                          />
                          <div className="absolute top-0 h-full w-0.5 bg-surface-700" style={{ left: `${Math.min(kri.threshold, 100)}%` }} />
                        </div>
                        <p className="text-xs text-surface-400">Threshold {kri.threshold}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-surface-900 mb-1">Industry Heatmap</h2>
                  <p className="text-xs text-surface-500 mb-4">Likelihood and impact proxy by risk domain</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-surface-400">Industry</th>
                          {RISK_DIMENSIONS.map((dim) => (
                            <th key={dim.label} className="px-3 py-2 text-center text-xs font-medium text-surface-500">
                              {dim.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.industries.map((industry) => (
                          <tr key={industry} className="border-t border-surface-100">
                            <td className="px-3 py-2.5 text-xs font-medium text-surface-700 whitespace-nowrap">{industry}</td>
                            {RISK_DIMENSIONS.map((dim) => {
                              const score = heatmap.lookup.get(`${industry}||${dim.label}`) ?? null;
                              return (
                                <td key={dim.label} className="px-2 py-2 text-center">
                                  <span className={`inline-flex min-w-10 justify-center rounded-md px-2 py-1 text-xs font-semibold ${heatCell(score)}`}>
                                    {score == null ? "-" : score.toFixed(1)}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-surface-900 mb-1">Top Risk Radar</h2>
                  <p className="text-xs text-surface-500 mb-4">Largest residual exposures by supplier</p>
                  <ResponsiveContainer width="100%" height={310}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#e4e7ec" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "#6b7689", fontWeight: 500 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10, fill: "#9aa3b4" }} tickCount={6} />
                      {suppliersInChart.map((name, i) => (
                        <Radar
                          key={name}
                          name={name}
                          dataKey={name}
                          stroke={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                          fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e4e7ec" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="card overflow-hidden xl:col-span-2">
                  <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-surface-900">Top Enterprise Risks</h2>
                      <p className="text-xs text-surface-500">Residual score, primary driver, and review age</p>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead>
                        <tr className="bg-surface-50/80 border-b border-surface-100">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Supplier</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Level</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Driver</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Score</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {topRisks.map(({ row, score, driver }) => (
                          <tr key={row.id} className="hover:bg-surface-50/70 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-sm font-medium text-surface-900">{getSupplierName(row)}</div>
                              <div className="text-xs text-surface-400">{getIndustry(row)} - {row.supplier_code}</div>
                            </td>
                            <td className="px-5 py-3.5"><RiskBadge level={row.overall_risk_level} /></td>
                            <td className="px-5 py-3.5 text-sm text-surface-600">{driver.label} ({driver.value})</td>
                            <td className={`px-5 py-3.5 text-right text-sm font-semibold ${scoreTone(score)}`}>{score.toFixed(2)}</td>
                            <td className="px-5 py-3.5 text-right text-sm text-surface-500">{formatDate(row.assessment_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-surface-900">Mitigation Tracker</h2>
                      <p className="text-xs text-surface-500">Action posture inferred from latest notes</p>
                    </div>
                    <ClipboardCheck className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="space-y-3">
                    {topRisks.slice(0, 5).map(({ row, score }) => {
                      const hasNotes = Boolean(row.notes?.trim());
                      const critical = row.overall_risk_level.toLowerCase() === "critical";
                      return (
                        <div key={row.id} className="rounded-lg border border-surface-100 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-surface-800 truncate">{getSupplierName(row)}</span>
                            <span className={`text-xs font-semibold ${scoreTone(score)}`}>{score.toFixed(1)}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            {hasNotes ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Treatment logged</span>
                              </>
                            ) : critical ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                <span className="text-red-700">Action required</span>
                              </>
                            ) : (
                              <>
                                <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-amber-700">Owner review due</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-100">
                  <h2 className="text-sm font-semibold text-surface-900">Risk Register</h2>
                  <p className="text-xs text-surface-500">Latest assessment per supplier after active filters</p>
                </div>
                {filteredRows.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No suppliers match the selected filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px]">
                      <thead>
                        <tr className="border-b border-surface-200 bg-surface-50/50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Supplier</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Date</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Risk Level</th>
                          {RISK_DIMENSIONS.map((dim) => (
                            <th key={dim.key} className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">{dim.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <motion.tbody className="divide-y divide-surface-100" variants={staggerContainer} initial="hidden" animate="visible">
                        {filteredRows.map((r) => (
                          <motion.tr key={r.id} variants={staggerItem} className="hover:bg-surface-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-medium text-surface-900">{getSupplierName(r)}</span>
                              <span className="ml-2 text-xs font-mono text-surface-400">{r.supplier_code}</span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-surface-600">{formatDate(r.assessment_date)}</td>
                            <td className="px-5 py-3.5"><RiskBadge level={r.overall_risk_level} /></td>
                            {RISK_DIMENSIONS.map((dim) => (
                              <td key={dim.key} className="px-5 py-3.5 text-right text-sm text-surface-600">{Number(r[dim.key])}</td>
                            ))}
                          </motion.tr>
                        ))}
                      </motion.tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "new-assessment" && canCreateAssessment && (
        <div className="max-w-2xl space-y-6">
          {unreviewedSuppliers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-amber-700 text-sm font-medium">
                  {unreviewedSuppliers.length} supplier{unreviewedSuppliers.length > 1 ? "s" : ""} not yet assessed this month ({currentMonth})
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnreviewed((o) => !o)}
                  className="text-xs text-amber-700 underline hover:text-amber-900"
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
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">New Risk Assessment</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Supplier</label>
              <select
                value={form.supplier_id}
                onChange={(e) => {
                  setRiskFactorMatch(null);
                  setRiskFactorError(null);
                  setForm((f) => ({ ...f, supplier_id: e.target.value }));
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.country ? ` (${s.country})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Assessment Date</label>
              <input
                type="date"
                value={form.assessment_date}
                onChange={(e) => setForm((f) => ({ ...f, assessment_date: e.target.value }))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-950">Real data factor: country stability</h3>
                  <p className="mt-1 text-xs text-blue-800">
                    Download the World Bank WGI CSV zip, extract the data CSV, then upload it here.
                  </p>
                </div>
                <a href={WGI_DOWNLOAD_URL} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 underline underline-offset-2">
                  Download WGI CSV zip
                </a>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                <Upload className="h-4 w-4" />
                Upload CSV and calculate
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void handleRiskFactorUpload(e.target.files?.[0] ?? null)} />
              </label>

              <p className="text-xs text-blue-900">Criteria: percentile 80+ = risk 1, 60-79 = 2, 40-59 = 3, 20-39 = 4, below 20 = 5.</p>

              {selectedSupplier && (
                <p className="text-xs text-blue-800">
                  Selected supplier country: <span className="font-semibold">{selectedSupplier.country ?? "missing"}</span>
                </p>
              )}

              {riskFactorMatch && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Matched {riskFactorMatch.countryName} ({riskFactorMatch.year}) percentile {riskFactorMatch.percentile}. Geopolitical Risk set to <span className="font-semibold">{riskFactorMatch.geopoliticalRisk}</span>.
                </div>
              )}

              {riskFactorError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{riskFactorError}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Risk Scores (1 = lowest - 5 = highest)</label>
              <div className="grid grid-cols-2 gap-4">
                {RISK_DIMENSIONS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="1-5"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional assessment notes..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {submitError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>}

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
