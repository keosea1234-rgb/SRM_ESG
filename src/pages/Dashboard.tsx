import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Building2,
  TrendingUp,
  ShieldAlert,
  FileWarning,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  TrendingDown,
} from "lucide-react";
import { queryKeys } from "../lib/queryKeys";
import { fetchDashboardStats } from "../services/dashboard";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import PortfolioHealthWidget from "../components/PortfolioHealthWidget";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyValue } from "../components/ui/EmptyValue";
import { usePageTitle } from "../hooks/usePageTitle";

const colorMap: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600",
  emerald: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
};

const statCardBorderMap: Record<string, string> = {
  brand: "border-l-4 border-brand-500",
  emerald: "border-l-4 border-emerald-500",
  red: "border-l-4 border-red-500",
  amber: "border-l-4 border-amber-500",
};

function riskBadge(level: string | null) {
  if (!level) return null;
  const cls: Record<string, string> = {
    low: "risk-low", medium: "risk-medium", high: "risk-high", critical: "risk-critical",
  };
  const labels: Record<string, string> = {
    low: "Low", medium: "Medium", high: "High", critical: "Critical",
  };
  return <span className={`badge ${cls[level] || ""}`}>{labels[level] || level}</span>;
}

function scoreColor(score: number | null) {
  if (score == null) return "text-surface-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-brand-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Sparkline({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 22;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className ?? "mt-2"}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChangeBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || value === undefined) return <span className="text-xs text-surface-400">—</span>;
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  const prefix = value > 0 ? "+" : "";
  const cls = neutral
    ? "text-surface-400"
    : positive
    ? "text-emerald-600"
    : "text-red-500";
  return <span className={`text-xs font-medium ${cls}`}>{prefix}{value} since last month</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();

  usePageTitle("Dashboard");

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: {
      industry: "all",
    },
    debounceKeys: [],
  });

  const dashboardIndustry =
    filters.industry && filters.industry !== "all"
      ? (filters.industry as string)
      : undefined;

  const {
    data: stats,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.dashboard(dashboardIndustry),
    queryFn: () => fetchDashboardStats(dashboardIndustry),
  });

  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const filterFields: FilterFieldConfig[] = [
    {
      key: "industry",
      type: "select",
      options: [
        { value: "all", label: "All industries" },
        { value: "Manufacturing", label: "Manufacturing" },
        { value: "Logistics", label: "Logistics" },
        { value: "Technology", label: "Technology" },
        { value: "Energy", label: "Energy" },
        { value: "Healthcare", label: "Healthcare" },
      ],
      minWidth: "160px",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div>
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full mt-3 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card p-5 border-l-4 border-surface-200">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
                </div>
                <Skeleton className="h-9 w-20 mt-3 rounded-md" />
                <Skeleton className="h-3 w-32 mt-2 rounded" />
                <div className="mt-4 flex items-end justify-between gap-2">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-[22px] w-20 rounded shrink-0" />
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5 space-y-4">
            <Skeleton className="h-5 w-44 rounded" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-100">
              <Skeleton className="h-5 w-40 rounded" />
            </div>
            <div className="divide-y divide-surface-100">
              {[1, 2, 3, 4, 5].map((r) => (
                <div key={r} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-4 w-6 rounded shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 max-w-[200px] rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full shrink-0" />
                  <Skeleton className="h-6 w-12 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-100">
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <div className="px-5 py-4 space-y-4">
              {[1, 2, 3, 4].map((r) => (
                <div key={r} className="pl-4 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  const topSuppliers = stats?.topSuppliers ?? [];
  const recentActivities = stats?.recentActivities ?? [];

  const vs = stats?.vsLastMonth ?? null;
  const sparklines = stats?.sparklineData ?? [];
  const supplierSparkValues = sparklines.map((s) => s.total_suppliers);
  const perfSparkValues = sparklines
    .map((s) => s.avg_performance_score)
    .filter((v): v is number => v !== null);
  const riskSparkValues = sparklines.map((s) => s.high_risk_count);

  const statCards = [
    {
      label: "Total Suppliers",
      value: stats?.totalSuppliers ?? "—",
      badge: <ChangeBadge value={vs?.suppliersChange ?? null} />,
      sparkValues: supplierSparkValues,
      sparkColor: "#2563eb",
      icon: Building2,
      color: "brand",
      onClick: () => navigate("/suppliers"),
    },
    {
      label: "Avg. Performance",
      value: stats?.avgPerformanceScore ?? "—",
      badge: <ChangeBadge value={vs?.performanceChange ?? null} />,
      sparkValues: perfSparkValues,
      sparkColor: "#16a34a",
      icon: TrendingUp,
      color: "emerald",
      onClick: () => navigate("/performance"),
    },
    {
      label: "High Risk",
      value: stats?.highRiskCount ?? "—",
      badge: <ChangeBadge value={vs?.riskChange ?? null} invert />,
      sparkValues: riskSparkValues,
      sparkColor: "#dc2626",
      icon: ShieldAlert,
      color: "red",
      onClick: () => navigate("/risk"),
    },
    {
      label: "Expiring Documents",
      value: stats?.expiringDocsCount ?? "—",
      badge: <ChangeBadge value={null} />,
      sparkValues: [],
      sparkColor: "#d97706",
      icon: FileWarning,
      color: "amber",
      onClick: () => navigate("/suppliers"),
    },
  ];

  const actionItems: {
    kind: "risk" | "expiring" | "declining";
    message: string;
    href: string;
    color: string;
  }[] = [];
  if ((stats?.highRiskCount ?? 0) > 0) {
    actionItems.push({
      kind: "risk",
      message: `${stats!.highRiskCount} supplier${stats!.highRiskCount > 1 ? "s" : ""} at high or critical risk`,
      href: "/risks",
      color: "border-red-200 bg-red-50 hover:bg-red-100",
    });
  }
  if ((stats?.expiringDocsCount ?? 0) > 0) {
    actionItems.push({
      kind: "expiring",
      message: `${stats!.expiringDocsCount} document${stats!.expiringDocsCount > 1 ? "s" : ""} expiring within 30 days`,
      href: "/suppliers",
      color: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    });
  }
  (stats?.decliningSuppliers ?? []).forEach((s) => {
    actionItems.push({
      kind: "declining",
      message: `${s.name} performance dropped from ${s.previous_score.toFixed(1)} to ${s.latest_score.toFixed(1)}`,
      href: `/suppliers/${s.id}`,
      color: "border-orange-200 bg-orange-50 hover:bg-orange-100",
    });
  });

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-surface-900">Dashboard</h1>
        <p className="text-sm text-surface-500 mt-1">Supplier management overview</p>
      </div>

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
        onReset={resetFilters}
        activeCount={activeCount}
      />

      {/* ── Main Hero Section: Stat Cards (left 50%) + Portfolio Health (right 50%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* LEFT: 2×2 stat cards */}
        <motion.div
          className="grid grid-cols-2 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {statCards.map((stat) => {
            const numericValue = typeof stat.value === "number" ? stat.value : null;
            const iconAlertClass =
              numericValue != null &&
              numericValue > 0 &&
              stat.color === "red"
                ? "ring-2 ring-red-200 ring-offset-2 animate-pulse"
                : numericValue != null &&
                    numericValue > 0 &&
                    stat.color === "amber"
                  ? "ring-2 ring-amber-200 ring-offset-1"
                  : "";
            return (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className={`card p-5 cursor-pointer hover:shadow-md transition-shadow ${statCardBorderMap[stat.color]}`}
              onClick={stat.onClick}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[stat.color]} ${iconAlertClass}`.trim()}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-surface-200 shrink-0" />
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold text-surface-900">{stat.value}</p>
                <p className="text-xs text-surface-500 uppercase tracking-wide mt-1">{stat.label}</p>
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div className="min-w-0">{stat.badge}</div>
                <div className="ml-auto shrink-0">
                  <Sparkline values={stat.sparkValues} color={stat.sparkColor} className="mt-0" />
                </div>
              </div>
            </motion.div>
            );
          })}
        </motion.div>

        {/* RIGHT: Portfolio Health 2×2 */}
        {stats && <PortfolioHealthWidget stats={stats} />}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="font-display text-base font-semibold text-surface-900 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-2 mb-0.5" />
              Action Items
            </h2>
          </div>
          <motion.div
            className="divide-y divide-surface-100"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {actionItems.map((item, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Link
                  to={item.href}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center gap-3 px-5 py-3.5 border-l-4 transition-colors ${item.color}`}
                >
                  {item.kind === "risk" ? (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  ) : item.kind === "expiring" ? (
                    <Clock className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 flex-shrink-0 text-orange-500" />
                  )}
                  <p className="text-sm text-surface-800">{item.message}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Supplier Ranking */}
        <div className="lg:col-span-3 card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="font-display text-base font-semibold text-surface-900 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-2 mb-0.5" />
              Supplier Ranking
            </h2>
          </div>
          <motion.div
            className="divide-y divide-surface-100"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {topSuppliers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-surface-400">No data yet.</p>
            ) : (
              topSuppliers.map((s, i) => (
                <motion.div
                  key={s.id}
                  variants={staggerItem}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/suppliers/${s.id}`)}
                >
                  <span className="w-6 text-center text-sm font-medium text-surface-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 truncate">{s.name}</p>
                    <p className="text-xs text-surface-500">{s.contract_count} contracts</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {riskBadge(s.current_risk_level)}
                    <div
                      className={`relative min-h-[1.25rem] flex items-center rounded overflow-hidden px-2 py-0.5 ${scoreColor(s.latest_score)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-current opacity-5 pointer-events-none"
                        style={{ width: `${s.latest_score ?? 0}%` }}
                        aria-hidden
                      />
                      <span className="relative text-sm font-semibold tabular-nums">
                        {s.latest_score != null ? s.latest_score.toFixed(1) : <EmptyValue />}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="font-display text-base font-semibold text-surface-900 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-2 mb-0.5" />
              Recent Activity
            </h2>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {recentActivities.length === 0 ? (
              <p className="px-5 py-4 text-sm text-surface-400">No activity yet.</p>
            ) : (
              <div className="border-l-2 border-surface-100 ml-4 divide-y divide-surface-100">
                {recentActivities.map((a) => (
                  <motion.div key={a.id} variants={staggerItem} className="pl-4 relative py-3 pr-5">
                    <span
                      className="absolute -left-[9px] top-3 w-3 h-3 rounded-full bg-white border-2 border-surface-200"
                      aria-hidden
                    />
                    <p className="text-sm text-surface-700 leading-snug">{a.description}</p>
                    <p className="text-xs text-surface-400 mt-1">{timeAgo(a.performed_at)}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
