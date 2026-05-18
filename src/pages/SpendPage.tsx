import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileWarning,
  FolderTree,
  Globe2,
  HandCoins,
  Layers3,
  LineChart as LineChartIcon,
  Network,
  Search,
  RefreshCcw,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { queryKeys } from "../lib/queryKeys";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  fetchSpendSummary,
  type SpendAnalystGroup,
  type SpendBusinessGroupBreakdown,
  type SpendDetailRow,
  type SpendExportRow,
  type SpendFilterOption,
  type SpendOpportunity,
  type SpendSummaryResponse,
  type SpendSummaryNode,
  type SpendSupplierBreakdown,
  type SpendTrendPoint,
} from "../services/spend";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyValue } from "../components/ui/EmptyValue";

function formatSpend(amount: number, currencies: string[]) {
  const currency = currencies.length === 1 ? currencies[0] : "USD";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

  return currencies.length <= 1 ? formatted : `${formatted} mixed`;
}

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatCompactSpend(amount: number, currencies: string[]) {
  const currency = currencies.length === 1 ? currencies[0] : "USD";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

  return currencies.length <= 1 ? formatted : `${formatted} mixed`;
}

function pctOf(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function topNWithOther<T extends { totalSpend: number; name?: string; supplierName?: string; path?: string }>(
  rows: T[],
  totalSpend: number,
  limit: number
) {
  const visible = rows.slice(0, limit).map((row) => ({
    name: row.name ?? row.supplierName ?? row.path ?? "Unknown",
    totalSpend: row.totalSpend,
    share: pctOf(row.totalSpend, totalSpend),
  }));
  const otherSpend = Math.max(totalSpend - visible.reduce((sum, row) => sum + row.totalSpend, 0), 0);
  if (otherSpend > 0) {
    visible.push({ name: "Other", totalSpend: otherSpend, share: pctOf(otherSpend, totalSpend) });
  }
  return visible;
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: SpendExportRow[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as Array<keyof SpendExportRow>;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function riskBadgeClass(level: string | null) {
  const key = level?.toLowerCase();
  if (key === "critical") return "risk-critical";
  if (key === "high") return "risk-high";
  if (key === "medium") return "risk-medium";
  if (key === "low") return "risk-low";
  return "bg-surface-100 text-surface-600 border border-surface-200";
}

function coverageBadgeClass(status: SpendSupplierBreakdown["contractCoverageStatus"]) {
  if (status === "covered") return "badge-active";
  if (status === "partial") return "bg-amber-100 text-amber-800 border border-amber-300 font-semibold";
  return "badge-pending";
}

function healthBandClass(band: SpendSupplierBreakdown["healthBand"]) {
  if (band === "strong") return "bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold";
  if (band === "watch") return "bg-amber-100 text-amber-800 border border-amber-300 font-semibold";
  if (band === "at_risk") return "bg-red-100 text-red-800 border border-red-300 font-semibold";
  return "bg-surface-100 text-surface-600 border border-surface-200";
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  tone?: "brand" | "green" | "amber" | "red" | "surface";
}) {
  const toneClass = {
    brand: "border-brand-500 bg-brand-50 text-brand-600",
    green: "border-emerald-500 bg-emerald-50 text-emerald-600",
    amber: "border-amber-500 bg-amber-50 text-amber-600",
    red: "border-red-500 bg-red-50 text-red-600",
    surface: "border-surface-400 bg-surface-100 text-surface-600",
  }[tone];
  const [borderClass, iconBgClass, iconTextClass] = toneClass.split(" ");
  return (
    <div className={`card p-4 border-l-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBgClass} ${iconTextClass} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-surface-400 text-right">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-surface-900 truncate">{value}</p>
      <p className="mt-1 text-xs text-surface-500">{hint}</p>
    </div>
  );
}

function MultiFilterPopover({
  label,
  allLabel,
  values,
  options,
  onChange,
  icon: Icon,
  hierarchical = false,
}: {
  label: string;
  allLabel: string;
  values: string[];
  options: SpendFilterOption[];
  onChange: (values: string[]) => void;
  icon: React.ElementType;
  hierarchical?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOptions = options.filter((option) => values.includes(option.value));
  const query = search.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.name}`.toLowerCase().includes(query)
  );

  const toggleValue = (nextValue: string) => {
    onChange(
      values.includes(nextValue)
        ? values.filter((value) => value !== nextValue)
        : [...values, nextValue]
    );
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full h-11 px-3 rounded-lg border border-surface-300 bg-white text-left hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-brand-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-surface-400 leading-none">{label}</p>
            <p className="text-sm font-medium text-surface-900 truncate mt-1">
              {selectedOptions.length === 0
                ? allLabel
                : selectedOptions.length === 1
                  ? selectedOptions[0].name
                  : `${selectedOptions.length} selected`}
            </p>
          </div>
          {selectedOptions.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {selectedOptions.length}
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-surface-400 shrink-0" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full min-w-[18rem] rounded-lg border border-surface-200 bg-white shadow-xl">
          <div className="p-2 border-b border-surface-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="input-field h-9 pl-9 text-sm"
              />
            </div>
            <p className="mt-1 text-[11px] text-surface-400">{filteredOptions.length} matches</p>
          </div>
          <div className="max-h-72 overflow-auto p-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-50"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                {values.length === 0 && <Check className="w-4 h-4 text-brand-600" />}
              </span>
              <span className="font-medium text-surface-800">{allLabel}</span>
            </button>

            {filteredOptions.map((option) => {
              const depth = hierarchical ? Math.max((option.level ?? 1) - 1, 0) : 0;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className="w-full flex items-start gap-2 rounded-md py-2 pr-3 text-left hover:bg-surface-50"
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  <span className="w-4 h-5 flex items-center justify-center shrink-0">
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        values.includes(option.value)
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-surface-300 bg-white"
                      }`}
                    >
                      {values.includes(option.value) && <Check className="w-3 h-3" />}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-surface-900 truncate">{option.name}</span>
                    <span className="block text-xs text-surface-500 truncate">
                      {hierarchical ? `L${option.level ?? 1} - ${option.path ?? option.label}` : option.label}
                    </span>
                  </span>
                  {(option.recordCount ?? 0) > 0 && (
                    <span className="shrink-0 text-[11px] text-surface-400">{option.recordCount}</span>
                  )}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-surface-400">No matching filters</div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-surface-100 px-3 py-2">
            <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-surface-500 hover:text-brand-700">
              Clear {selectedOptions.length}
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: "30d" | "90d" | "ytd" | "12m") {
  const today = new Date();
  const start = new Date(today);

  if (preset === "30d") start.setDate(today.getDate() - 30);
  if (preset === "90d") start.setDate(today.getDate() - 90);
  if (preset === "12m") start.setFullYear(today.getFullYear() - 1);
  if (preset === "ytd") {
    start.setMonth(0);
    start.setDate(1);
  }

  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(today),
  };
}

function DateRangeControl({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (range: { dateFrom: string; dateTo: string }) => void;
}) {
  const presets = [
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "ytd", label: "YTD" },
    { value: "12m", label: "12M" },
  ] as const;

  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-surface-800">
          <CalendarDays className="w-4 h-4 text-brand-600" />
          Date range
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-surface-200 bg-white p-1">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChange(getPresetRange(preset.value))}
                className="h-8 px-3 rounded-md text-xs font-semibold text-surface-600 hover:bg-brand-50 hover:text-brand-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 min-w-0">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onChange({ dateFrom: event.target.value, dateTo })}
              className="input-field h-10 min-w-0"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onChange({ dateFrom, dateTo: event.target.value })}
              className="input-field h-10 min-w-0"
            />
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white overflow-hidden">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-brand-500 via-amcorGreen to-accent" />
      </div>
    </div>
  );
}

function SpendCommandHeader({
  data,
  currencies,
}: {
  data: SpendSummaryResponse;
  currencies: string[];
}) {
  const leakagePct = pctOf(data.kpis.unmanagedSpend, data.kpis.totalSpend);
  const riskPct = pctOf(data.kpis.highRiskSpend, data.kpis.totalSpend);
  const coverageTone =
    data.kpis.contractCoveragePct >= 70
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : data.kpis.contractCoveragePct >= 40
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-red-700 bg-red-50 border-red-200";
  const primaryMove =
    data.opportunities[0]?.recommendedAction ??
    "Keep monitoring spend concentration, supplier risk, and contract coverage.";

  const metrics = [
    {
      label: "Addressable Spend",
      value: formatCompactSpend(data.kpis.totalSpend, currencies),
      sub: `${data.totals.recordsCount} records`,
      icon: HandCoins,
    },
    {
      label: "Leakage",
      value: formatPct(leakagePct),
      sub: formatCompactSpend(data.kpis.unmanagedSpend, currencies),
      icon: FileWarning,
    },
    {
      label: "Risk Exposure",
      value: formatPct(riskPct),
      sub: formatCompactSpend(data.kpis.highRiskSpend, currencies),
      icon: AlertTriangle,
    },
    {
      label: "Contract Coverage",
      value: formatPct(data.kpis.contractCoveragePct),
      sub: `${data.contractCoverage.managedSupplierCount} managed suppliers`,
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="rounded-lg border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_2fr]">
        <div className="border-b border-surface-100 p-5 xl:border-b-0 xl:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Spend Analytics Command</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-surface-950">Sourcing cockpit</h2>
          <p className="mt-2 text-sm leading-relaxed text-surface-600">
            Prioritize contract leakage, risk-adjusted exposure, supplier concentration and category leverage in one view.
          </p>
          <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${coverageTone}`}>
            {data.kpis.contractCoveragePct >= 70 ? "Controlled portfolio" : data.kpis.contractCoveragePct >= 40 ? "Coverage needs attention" : "Leakage control required"}
          </div>
          <div className="mt-5 rounded-lg border border-brand-100 bg-brand-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Next best action</p>
            <p className="mt-1 text-sm font-medium leading-snug text-surface-900">{primaryMove}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="border-b border-surface-100 p-5 sm:border-r xl:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-surface-300" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-400">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold text-surface-950">{metric.value}</p>
                <p className="mt-1 text-xs text-surface-500">{metric.sub}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SpendParetoPanel({
  suppliers,
  totalSpend,
  currencies,
}: {
  suppliers: SpendSupplierBreakdown[];
  totalSpend: number;
  currencies: string[];
}) {
  let running = 0;
  const rows = suppliers.slice(0, 8).map((supplier) => {
    running += supplier.totalSpend;
    return {
      name: supplier.supplierName,
      totalSpend: supplier.totalSpend,
      cumulative: pctOf(running, totalSpend),
    };
  });

  return (
    <div className="card p-4 min-h-[330px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Supplier Pareto</h2>
          <p className="mt-1 text-xs text-surface-500">Top supplier concentration with cumulative share</p>
        </div>
        <LineChartIcon className="h-5 w-5 text-brand-600" />
      </div>
      {rows.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-surface-400">No supplier spend to chart.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis yAxisId="spend" hide />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) =>
                  name === "totalSpend"
                    ? [formatSpend(Number(value), currencies), "Spend"]
                    : [`${Number(value).toFixed(1)}%`, "Cumulative"]
                }
                contentStyle={{ borderRadius: 8, borderColor: "#e4e7ec", fontSize: 12 }}
              />
              <Bar yAxisId="spend" dataKey="totalSpend" fill="#0083bc" radius={[5, 5, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CategoryTreemapPanel({
  categories,
  totalSpend,
  currencies,
}: {
  categories: SpendSummaryNode[];
  totalSpend: number;
  currencies: string[];
}) {
  const rows = categories.slice(0, 12).map((category) => ({
    name: category.name,
    path: category.path,
    size: category.totalSpend,
    share: pctOf(category.totalSpend, totalSpend),
  }));

  return (
    <div className="card p-4 min-h-[330px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Category Spend Map</h2>
          <p className="mt-1 text-xs text-surface-500">Visual weight of category nodes in the filtered scope</p>
        </div>
        <Layers3 className="h-5 w-5 text-brand-600" />
      </div>
      {rows.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-surface-400">No category spend to chart.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={rows}
              dataKey="size"
              nameKey="name"
              stroke="#ffffff"
              fill="#0083bc"
              aspectRatio={4 / 3}
            >
              <Tooltip
                formatter={(value) => [formatSpend(Number(value), currencies), "Spend"]}
                contentStyle={{ borderRadius: 8, borderColor: "#e4e7ec", fontSize: 12 }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SpendMixPanel({
  data,
  currencies,
}: {
  data: SpendSummaryResponse;
  currencies: string[];
}) {
  const mix = [
    { name: "Managed", value: data.kpis.managedSpend, color: "#10b981" },
    { name: "Unmanaged", value: data.kpis.unmanagedSpend, color: "#f59e0b" },
  ];
  const health = [
    { name: "Strong", value: data.supplierHealthSummary.strongSupplierCount, color: "#10b981" },
    { name: "Watch", value: data.supplierHealthSummary.watchSupplierCount, color: "#f59e0b" },
    { name: "At risk", value: data.supplierHealthSummary.atRiskSupplierCount, color: "#ef4444" },
    { name: "Unknown", value: data.supplierHealthSummary.unknownSupplierCount, color: "#94a3b8" },
  ].filter((item) => item.value > 0);

  return (
    <div className="card p-4 min-h-[330px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Coverage & Health Mix</h2>
          <p className="mt-1 text-xs text-surface-500">Contract control and supplier health distribution</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-brand-600" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {mix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip
                formatter={(value) => [formatSpend(Number(value), currencies), "Spend"]}
                contentStyle={{ borderRadius: 8, borderColor: "#e4e7ec", fontSize: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 self-center">
          {health.length === 0 ? (
            <p className="text-sm text-surface-400">No supplier health context yet.</p>
          ) : (
            health.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-surface-700">{item.name}</span>
                  <span className="text-surface-500">{item.value}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pctOf(item.value, data.totals.supplierCount)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RiskCoverageMap({
  suppliers,
  currencies,
}: {
  suppliers: SpendSupplierBreakdown[];
  currencies: string[];
}) {
  const rows = suppliers.slice(0, 24).map((supplier) => ({
    supplierName: supplier.supplierName,
    healthScore: supplier.healthScore ?? 0,
    totalSpend: supplier.totalSpend,
    contractCoverageGap: supplier.contractCoverageGap,
    currentRiskLevel: supplier.currentRiskLevel ?? "unknown",
  }));

  return (
    <div className="card p-4 min-h-[330px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Risk / Coverage Map</h2>
          <p className="mt-1 text-xs text-surface-500">Supplier spend by health score and coverage gap</p>
        </div>
        <Network className="h-5 w-5 text-brand-600" />
      </div>
      {rows.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-surface-400">No supplier context to chart.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
              <CartesianGrid stroke="#eef2f7" />
              <XAxis dataKey="healthScore" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} name="Health" unit="" />
              <YAxis dataKey="totalSpend" type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => formatCompactSpend(Number(value), currencies)} name="Spend" />
              <ZAxis dataKey="contractCoverageGap" range={[80, 420]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, name) => {
                  if (name === "totalSpend") return [formatSpend(Number(value), currencies), "Spend"];
                  if (name === "contractCoverageGap") return [formatSpend(Number(value), currencies), "Coverage gap"];
                  if (name === "healthScore") return [Number(value).toFixed(1), "Health"];
                  return [String(value), String(name)];
                }}
                contentStyle={{ borderRadius: 8, borderColor: "#e4e7ec", fontSize: 12 }}
              />
              <Scatter data={rows} name="Suppliers">
                {rows.map((row) => {
                  const risk = row.currentRiskLevel.toLowerCase();
                  const fill = risk === "critical" ? "#dc2626" : risk === "high" ? "#f97316" : risk === "medium" ? "#f59e0b" : "#0083bc";
                  return <Cell key={row.supplierName} fill={fill} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TrendPanel({ data, currencies }: { data: SpendTrendPoint[]; currencies: string[] }) {
  return (
    <div className="card p-4 min-h-[260px]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Spend Trend</h2>
          <p className="text-xs text-surface-500 mt-1">Monthly movement for the filtered scope</p>
        </div>
        <TrendingUp className="w-5 h-5 text-brand-600" />
      </div>
      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-sm text-surface-400">No trend data</div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0083bc" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0083bc" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value) => formatSpend(Number(value), currencies)}
                contentStyle={{ borderRadius: 8, borderColor: "#e4e7ec", fontSize: 12 }}
              />
              <Area dataKey="totalSpend" stroke="#0083bc" fill="url(#spendTrend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function OpportunityPanel({ opportunities, currencies }: { opportunities: SpendOpportunity[]; currencies: string[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Opportunities</h2>
          <p className="text-xs text-surface-500 mt-1">Deterministic, explainable spend actions</p>
        </div>
        <Target className="w-5 h-5 text-brand-600" />
      </div>
      <div className="divide-y divide-surface-100">
        {opportunities.length === 0 ? (
          <div className="px-5 py-8 text-sm text-surface-400">No reliable opportunities for this filtered slice.</div>
        ) : (
          opportunities.map((item) => (
            <div key={item.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-surface-900">{item.title}</p>
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-surface-600">
                      {item.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 mt-1">{item.reason}</p>
                  <p className="text-xs text-brand-700 mt-2 font-medium">{item.recommendedAction}</p>
                  <p className="text-[11px] text-surface-400 mt-2">
                    {item.affectedSupplierCount} suppliers - {item.affectedRecordCount} records
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-surface-900">{formatSpend(item.impact, currencies)}</p>
                  <p className="text-[11px] text-surface-400 mt-1">impact</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SupplierRiskOverlay({ rows, currencies }: { rows: SpendSupplierBreakdown[]; currencies: string[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Supplier Risk Overlay</h2>
          <p className="text-xs text-surface-500 mt-1">Spend with risk, ESG, performance and contract context</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-brand-600" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-xs uppercase tracking-[0.08em] text-surface-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Supplier</th>
              <th className="px-3 py-3 text-left font-semibold">Risk</th>
              <th className="px-3 py-3 text-left font-semibold">Health</th>
              <th className="px-3 py-3 text-left font-semibold">Coverage</th>
              <th className="px-3 py-3 text-right font-semibold">Spend</th>
              <th className="px-3 py-3 text-right font-semibold">Perf</th>
              <th className="px-3 py-3 text-right font-semibold">ESG</th>
              <th className="px-5 py-3 text-right font-semibold">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {rows.slice(0, 8).map((row) => (
              <tr key={row.supplierId}>
                <td className="px-5 py-3 font-medium text-surface-900 max-w-[220px] truncate">{row.supplierName}</td>
                <td className="px-3 py-3">
                  <span className={`badge ${riskBadgeClass(row.currentRiskLevel)}`}>
                    {row.currentRiskLevel ?? "Not assessed"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`badge ${healthBandClass(row.healthBand ?? "unknown")}`}>
                    {(row.healthBand ?? "unknown").replace("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`badge ${coverageBadgeClass(row.contractCoverageStatus ?? "uncovered")}`}>
                    {row.contractCoverageStatus ?? "uncovered"}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-semibold">{formatSpend(row.totalSpend, currencies)}</td>
                <td className="px-3 py-3 text-right">{row.latestPerformanceScore?.toFixed(1) ?? "-"}</td>
                <td className="px-3 py-3 text-right">{row.esgScore?.toFixed(1) ?? "-"}</td>
                <td className="px-5 py-3 text-right">{formatSpend(row.contractCoverageGap ?? 0, currencies)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalystWorkspace({
  rows,
  currencies,
  totalSpend,
}: {
  rows: SpendAnalystGroup[];
  currencies: string[];
  totalSpend: number;
}) {
  const [groupBy, setGroupBy] = useState<SpendAnalystGroup["groupBy"] | "all">("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "high_risk" | "unmanaged" | "coverage_gap" | "tail_spend" | "top_supplier">("all");
  const tailThreshold = totalSpend * 0.02;
  const filteredRows = rows
    .filter((row) => groupBy === "all" || row.groupBy === groupBy)
    .filter((row) => {
      if (quickFilter === "all") return true;
      if (quickFilter === "tail_spend") return row.groupBy === "supplier" && row.totalSpend <= tailThreshold;
      if (quickFilter === "top_supplier") return row.groupBy === "supplier";
      return row.quickFilters?.includes(quickFilter);
    })
    .sort((a, b) => b.opportunityImpact - a.opportunityImpact || b.totalSpend - a.totalSpend);
  const groupOptions: Array<{ value: SpendAnalystGroup["groupBy"] | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "category", label: "Category" },
    { value: "supplier", label: "Supplier" },
    { value: "region", label: "Region" },
    { value: "businessGroup", label: "Business Group" },
  ];
  const quickOptions = [
    { value: "all", label: "All" },
    { value: "high_risk", label: "High Risk" },
    { value: "unmanaged", label: "Unmanaged" },
    { value: "coverage_gap", label: "Coverage Gap" },
    { value: "tail_spend", label: "Tail Spend" },
    { value: "top_supplier", label: "Top Suppliers" },
  ] as const;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Analyst Workspace</h2>
          <p className="text-xs text-surface-500 mt-1">Grouped by category, supplier, region and business group</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-surface-200 bg-white p-1">
            {groupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGroupBy(option.value)}
                className={`h-8 px-3 rounded-md text-xs font-semibold ${
                  groupBy === option.value ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-brand-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            value={quickFilter}
            onChange={(event) => setQuickFilter(event.target.value as typeof quickFilter)}
            className="input-field h-10 w-auto min-w-[150px] text-sm"
          >
            {quickOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Table2 className="w-5 h-5 text-brand-600" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-xs uppercase tracking-[0.08em] text-surface-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Group</th>
              <th className="px-3 py-3 text-left font-semibold">Type</th>
              <th className="px-3 py-3 text-right font-semibold">Spend</th>
              <th className="px-3 py-3 text-right font-semibold">Unmanaged</th>
              <th className="px-3 py-3 text-right font-semibold">High Risk</th>
              <th className="px-3 py-3 text-right font-semibold">Gap</th>
              <th className="px-5 py-3 text-right font-semibold">Suppliers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {filteredRows.slice(0, 12).map((row) => (
              <tr key={`${row.groupBy}-${row.id}`}>
                <td className="px-5 py-3 font-medium text-surface-900 max-w-[300px] truncate">{row.label}</td>
                <td className="px-3 py-3 text-surface-500">{row.groupBy}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatSpend(row.totalSpend, currencies)}</td>
                <td className="px-3 py-3 text-right">{formatSpend(row.unmanagedSpend, currencies)}</td>
                <td className="px-3 py-3 text-right">{formatSpend(row.highRiskSpend, currencies)}</td>
                <td className="px-3 py-3 text-right">{formatSpend(row.coverageGapSpend ?? 0, currencies)}</td>
                <td className="px-5 py-3 text-right">{row.supplierCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRows.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-surface-400">No analyst groups match the selected quick filter.</div>
      )}
    </div>
  );
}

function SpendDetailTable({
  rows,
  currencies,
  exportRows,
}: {
  rows: SpendDetailRow[];
  currencies: string[];
  exportRows: SpendExportRow[];
}) {
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortKey, setSortKey] = useState<"spendDate" | "supplierName" | "categoryPath" | "amount">("spendDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sortedRows = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const aValue = a[sortKey] ?? "";
      const bValue = b[sortKey] ?? "";
      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return sortDir === "asc" ? result : -result;
    });
  }, [rows, sortDir, sortKey]);
  const visibleRows = sortedRows.slice(0, visibleCount);
  const sortButton = (key: typeof sortKey, label: string, align = "text-left") => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        else {
          setSortKey(key);
          setSortDir(key === "amount" || key === "spendDate" ? "desc" : "asc");
        }
      }}
      className={`w-full ${align} font-semibold hover:text-brand-700`}
    >
      {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900">Spend Detail</h2>
          <p className="text-xs text-surface-500 mt-1">Export-ready transaction view</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-400">{rows.length} rows</span>
          <button
            type="button"
            onClick={() => downloadCsv("spend-export.csv", exportRows)}
            className="btn-secondary px-3 py-1.5 text-xs"
            disabled={exportRows.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-xs uppercase tracking-[0.08em] text-surface-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">{sortButton("spendDate", "Date")}</th>
              <th className="px-3 py-3 text-left font-semibold">{sortButton("supplierName", "Supplier")}</th>
              <th className="px-3 py-3 text-left font-semibold">{sortButton("categoryPath", "Category")}</th>
              <th className="px-3 py-3 text-left font-semibold">Region</th>
              <th className="px-3 py-3 text-left font-semibold">Coverage</th>
              <th className="px-5 py-3 text-right font-semibold">{sortButton("amount", "Amount", "text-right")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3 text-surface-500 whitespace-nowrap">{row.spendDate}</td>
                <td className="px-3 py-3 font-medium text-surface-900 max-w-[180px] truncate">{row.supplierName}</td>
                <td className="px-3 py-3 text-surface-600 max-w-[260px] truncate">{row.categoryPath ?? "-"}</td>
                <td className="px-3 py-3 text-surface-600 max-w-[220px] truncate">{row.regionPath ?? "-"}</td>
                <td className="px-3 py-3">
                  <span className={`badge ${row.isManaged ? "badge-active" : "badge-pending"}`}>
                    {row.isManaged ? "Managed" : "Unmanaged"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-semibold">{formatSpend(row.amount, [row.currency || currencies[0] || "USD"])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleCount < rows.length && (
        <div className="px-5 py-3 border-t border-surface-100 text-center">
          <button className="btn-secondary text-sm" onClick={() => setVisibleCount((count) => count + 10)}>
            View more
          </button>
        </div>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  renderRow,
}: {
  title: string;
  subtitle: string;
  rows: unknown[];
  renderRow: (row: any, index: number) => React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100">
        <h2 className="font-display text-base font-semibold text-surface-900">{title}</h2>
        <p className="text-xs text-surface-500 mt-1">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-sm text-surface-400">No spend data found for this slice.</div>
      ) : (
        <div className="divide-y divide-surface-100">{rows.map((row, index) => renderRow(row, index))}</div>
      )}
    </div>
  );
}

function HierarchyRow({
  row,
  currencies,
}: {
  row: SpendSummaryNode;
  currencies: string[];
}) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-900 truncate">{row.path}</p>
        <p className="text-xs text-surface-500 mt-1">
          Level {row.level} - {row.recordCount} records
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-surface-900">
          {formatSpend(row.totalSpend, currencies)}
        </p>
      </div>
    </div>
  );
}

function SupplierRow({
  row,
  currencies,
}: {
  row: SpendSupplierBreakdown;
  currencies: string[];
}) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-900 truncate">{row.supplierName}</p>
        <p className="text-xs text-surface-500 mt-1">
          {row.primaryCategoryPath ?? "No category"} - {row.isManaged ? "managed" : "unmanaged"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-surface-900">
          {formatSpend(row.totalSpend, currencies)}
        </p>
        <p className="text-xs text-surface-500 mt-1">{row.currentRiskLevel ?? "not assessed"}</p>
      </div>
    </div>
  );
}

function BusinessGroupRow({
  row,
  currencies,
}: {
  row: SpendBusinessGroupBreakdown;
  currencies: string[];
}) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-900 truncate">{row.name}</p>
        <p className="text-xs text-surface-500 mt-1">{row.recordCount} records</p>
      </div>
      <div className="text-right shrink-0 text-sm font-semibold text-surface-900">
        {formatSpend(row.totalSpend, currencies)}
      </div>
    </div>
  );
}

export default function SpendPage() {
  usePageTitle("Spend");

  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [businessGroupIds, setBusinessGroupIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryParams = {
    categoryIds,
    regionIds,
    supplierIds,
    businessGroupIds,
    dateFrom,
    dateTo,
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.spend(queryParams),
    queryFn: () => fetchSpendSummary(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const currencies = data?.totals.currencies ?? [];
  const allFilterOptions = useMemo(
    () => [
      ...(data?.filters.categories ?? []),
      ...(data?.filters.regions ?? []),
      ...(data?.filters.suppliers ?? []),
      ...(data?.filters.businessGroups ?? []),
    ],
    [data]
  );
  const selectedIds = [...categoryIds, ...regionIds, ...supplierIds, ...businessGroupIds];
  const activeFilterLabels = selectedIds
    .map((id) => allFilterOptions.find((option) => option.value === id)?.name)
    .filter(Boolean) as string[];
  const activeFilterCount = activeFilterLabels.length + (dateFrom || dateTo ? 1 : 0);

  const resetFilters = () => {
    setCategoryIds([]);
    setRegionIds([]);
    setSupplierIds([]);
    setBusinessGroupIds([]);
    setDateFrom("");
    setDateTo("");
  };
  const removeSelectedFilter = (id: string) => {
    setCategoryIds((values) => values.filter((value) => value !== id));
    setRegionIds((values) => values.filter((value) => value !== id));
    setSupplierIds((values) => values.filter((value) => value !== id));
    setBusinessGroupIds((values) => values.filter((value) => value !== id));
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div>
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full mt-2 rounded" />
        </div>
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card p-5">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-8 w-28 mt-4 rounded" />
              <Skeleton className="h-4 w-32 mt-3 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load spend summary."}
        </p>
        <button onClick={() => void refetch()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <div>
        <h1 className="font-display text-2xl font-semibold text-surface-900">Spend</h1>
        <p className="text-sm text-surface-500 mt-1">
          Hierarchical spend view by category, region, supplier, and business group.
        </p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-surface-800">
            <SlidersHorizontal className="w-4 h-4 text-brand-600" />
            Filters
          </div>
          {isFetching && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              Updating
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MultiFilterPopover
            label="Category"
            allLabel="All categories"
            values={categoryIds}
            options={data?.filters.categories ?? []}
            onChange={setCategoryIds}
            icon={FolderTree}
            hierarchical
          />
          <MultiFilterPopover
            label="Region"
            allLabel="All regions"
            values={regionIds}
            options={data?.filters.regions ?? []}
            onChange={setRegionIds}
            icon={Globe2}
            hierarchical
          />
          <MultiFilterPopover
            label="Supplier"
            allLabel="All suppliers"
            values={supplierIds}
            options={data?.filters.suppliers ?? []}
            onChange={setSupplierIds}
            icon={Building2}
          />
          <MultiFilterPopover
            label="Business group"
            allLabel="All business groups"
            values={businessGroupIds}
            options={data?.filters.businessGroups ?? []}
            onChange={setBusinessGroupIds}
            icon={Scale}
          />
        </div>

        <DateRangeControl
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(range) => {
            setDateFrom(range.dateFrom);
            setDateTo(range.dateTo);
          }}
        />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-surface-500">
            <span>
              {data?.totals.recordsCount ?? 0} records - {currencies.length === 0 ? "No currency" : currencies.join(", ")}
            </span>
            {activeFilterCount > 0 && (
              <>
                <span className="hidden sm:inline text-surface-300">|</span>
                {selectedIds.slice(0, 4).map((id, index) => {
                  const label = allFilterOptions.find((option) => option.value === id)?.name ?? id;
                  return (
                    <button
                      key={`${id}-${index}`}
                      type="button"
                      onClick={() => removeSelectedFilter(id)}
                      className="rounded-full bg-surface-100 px-2 py-1 font-medium text-surface-700 hover:bg-surface-200"
                    >
                      {label} x
                    </button>
                  );
                })}
                {activeFilterLabels.length > 4 && (
                  <span className="rounded-full bg-surface-100 px-2 py-1 font-medium text-surface-700">
                    +{activeFilterLabels.length - 4}
                  </span>
                )}
                {(dateFrom || dateTo) && (
                  <span className="rounded-full bg-surface-100 px-2 py-1 font-medium text-surface-700">
                    {dateFrom || "Start"} - {dateTo || "Today"}
                  </span>
                )}
              </>
            )}
          </div>
          <button onClick={resetFilters} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Reset filters
          </button>
        </div>
      </div>

      {data && <SpendCommandHeader data={data} currencies={currencies} />}

      {data && data.totals.recordsCount > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SpendParetoPanel
            suppliers={data.supplierBreakdown ?? []}
            totalSpend={data.kpis.totalSpend}
            currencies={currencies}
          />
          <CategoryTreemapPanel
            categories={data.categoryBreakdown ?? []}
            totalSpend={data.kpis.totalSpend}
            currencies={currencies}
          />
          <SpendMixPanel data={data} currencies={currencies} />
          <RiskCoverageMap suppliers={data.supplierBreakdown ?? []} currencies={currencies} />
        </div>
      )}

      <div>
        <h2 className="font-display text-base font-semibold text-surface-900">Operating Metrics</h2>
        <p className="text-xs text-surface-500 mt-1">Control KPIs for filtered spend, risk, coverage and supplier base.</p>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem}>
          <StatCard
            label="Total Spend"
            value={formatSpend(data?.kpis?.totalSpend ?? 0, currencies)}
            hint="Filtered spend total"
            icon={HandCoins}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Managed Spend"
            value={formatPct(data?.kpis?.managedSpendPct ?? 0)}
            hint={formatSpend(data?.kpis?.managedSpend ?? 0, currencies)}
            icon={ShieldCheck}
            tone="green"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Suppliers"
            value={data?.totals.supplierCount ?? 0}
            hint="Suppliers represented"
            icon={Building2}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Top Concentration"
            value={formatPct(data?.kpis?.topSupplierConcentrationPct ?? 0)}
            hint="Largest supplier share"
            icon={BarChart3}
            tone="amber"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Risk Adjusted"
            value={formatSpend(data?.kpis?.riskAdjustedSpend ?? 0, currencies)}
            hint="Weighted by supplier risk"
            icon={AlertTriangle}
            tone="red"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Unmanaged"
            value={formatSpend(data?.kpis?.unmanagedSpend ?? 0, currencies)}
            hint={`${data?.contractCoverage?.unmanagedSupplierCount ?? 0} suppliers`}
            icon={FileWarning}
            tone="amber"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="High Risk Spend"
            value={formatSpend(data?.kpis?.highRiskSpend ?? 0, currencies)}
            hint="High or critical risk"
            icon={AlertTriangle}
            tone="red"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Critical Spend"
            value={formatSpend(data?.kpis?.criticalSupplierSpend ?? 0, currencies)}
            hint={`${data?.supplierHealthSummary?.atRiskSupplierCount ?? 0} at-risk suppliers`}
            icon={AlertTriangle}
            tone="red"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="ESG Low Spend"
            value={formatSpend(data?.kpis?.esgLowSpend ?? 0, currencies)}
            hint="ESG score below 50"
            icon={Scale}
            tone="surface"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Categories"
            value={data?.totals.categoryCount ?? 0}
            hint="Category nodes with spend"
            icon={FolderTree}
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            label="Contract Coverage"
            value={formatPct(data?.kpis?.contractCoveragePct ?? 0)}
            hint={`${data?.contractCoverage?.managedSupplierCount ?? 0} managed suppliers`}
            icon={ShieldCheck}
            tone="green"
          />
        </motion.div>
      </motion.div>

      {data && data.totals.recordsCount === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-surface-500">No spend records found for the current filters.</p>
          <p className="text-xs text-surface-400 mt-2">
            Spend master data is ready, but the dashboard needs rows in `spend_records`.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <TrendPanel data={data?.trend ?? []} currencies={currencies} />
            </div>
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-surface-900">Contract Coverage</h2>
                  <p className="text-xs text-surface-500 mt-1">Active contract heuristic</p>
                </div>
                <ShieldCheck className="w-5 h-5 text-brand-600" />
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>Managed</span>
                    <span>{formatPct(data?.kpis?.contractCoveragePct ?? 0)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amcorGreen"
                      style={{ width: `${Math.min(data?.kpis?.contractCoveragePct ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-surface-50 p-3">
                    <p className="text-xs text-surface-500">Managed spend</p>
                    <p className="mt-1 text-sm font-semibold">{formatSpend(data?.contractCoverage?.managedSpend ?? 0, currencies)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-50 p-3">
                    <p className="text-xs text-surface-500">Unmanaged spend</p>
                    <p className="mt-1 text-sm font-semibold">{formatSpend(data?.contractCoverage?.unmanagedSpend ?? 0, currencies)}</p>
                  </div>
                </div>
                <div className="text-xs text-surface-500">
                  {data?.contractCoverage?.unmanagedSupplierCount ?? 0} suppliers have spend but no active contract.
                  {" "}
                  {data?.contractCoverage?.partiallyCoveredSupplierCount ?? 0} suppliers are partially covered.
                </div>
                <div className="rounded-lg border border-surface-100 overflow-hidden">
                  <div className="flex items-center justify-between bg-surface-50 px-3 py-2">
                    <p className="text-xs font-semibold text-surface-700">Largest coverage gaps</p>
                    <p className="text-xs text-surface-500">
                      {formatSpend(data?.contractCoverage?.coverageGapSpend ?? 0, currencies)}
                    </p>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {(data?.contractCoverage?.suppliersWithCoverageGap ?? []).slice(0, 4).map((supplier) => (
                      <div key={supplier.supplierId} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-surface-900">{supplier.supplierName}</p>
                          <p className="text-[11px] text-surface-500">{supplier.contractCoverageStatus ?? "uncovered"}</p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold text-surface-900">
                          {formatSpend(supplier.contractCoverageGap ?? 0, currencies)}
                        </p>
                      </div>
                    ))}
                    {(data?.contractCoverage?.suppliersWithCoverageGap ?? []).length === 0 && (
                      <div className="px-3 py-4 text-xs text-surface-400">No contract coverage gaps.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <OpportunityPanel opportunities={data?.opportunities ?? []} currencies={currencies} />
            <SupplierRiskOverlay rows={data?.supplierRiskOverlay ?? []} currencies={currencies} />
          </div>

          {(data?.dataQualityWarnings ?? []).length > 0 && (
            <div className="card p-4 border-l-4 border-amber-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-surface-900">Data quality notes</h2>
                  <div className="mt-2 space-y-1">
                    {(data?.dataQualityWarnings ?? []).map((warning) => (
                      <p key={warning} className="text-xs text-surface-600">{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <BreakdownCard
              title="Category Breakdown"
              subtitle="Full path totals across the 4-level category tree"
              rows={(data?.categoryBreakdown ?? []).slice(0, 8)}
              renderRow={(row: SpendSummaryNode, index) => (
                <HierarchyRow key={`${row.id}-${index}`} row={row} currencies={currencies} />
              )}
            />
            <BreakdownCard
              title="Region Breakdown"
              subtitle="Spend distribution from continent down to plant"
              rows={(data?.regionBreakdown ?? []).slice(0, 8)}
              renderRow={(row: SpendSummaryNode, index) => (
                <HierarchyRow key={`${row.id}-${index}`} row={row} currencies={currencies} />
              )}
            />
            <BreakdownCard
              title="Supplier Breakdown"
              subtitle="Top suppliers with contract and risk context"
              rows={(data?.supplierBreakdown ?? []).slice(0, 8)}
              renderRow={(row: SpendSupplierBreakdown, index) => (
                <SupplierRow key={`${row.supplierId}-${index}`} row={row} currencies={currencies} />
              )}
            />
            <BreakdownCard
              title="Business Group Breakdown"
              subtitle="Spend concentration by business group"
              rows={(data?.businessGroupBreakdown ?? []).slice(0, 8)}
              renderRow={(row: SpendBusinessGroupBreakdown, index) => (
                <BusinessGroupRow key={`${row.id}-${index}`} row={row} currencies={currencies} />
              )}
            />
          </div>

          <AnalystWorkspace
            rows={data?.analystWorkspace ?? []}
            currencies={currencies}
            totalSpend={data?.kpis?.totalSpend ?? 0}
          />
          <SpendDetailTable
            rows={data?.spendRows ?? []}
            currencies={currencies}
            exportRows={data?.exportRows ?? []}
          />
        </div>
      )}

      {data?.totals.recordsCount === 0 && <EmptyValue />}
    </motion.div>
  );
}
