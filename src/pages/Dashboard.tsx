import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileWarning,
  HandCoins,
  Leaf,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { queryKeys } from "../lib/queryKeys";
import { fetchDashboardStats, type DashboardOverview } from "../services/dashboard";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import PortfolioHealthWidget from "../components/PortfolioHealthWidget";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyValue } from "../components/ui/EmptyValue";
import { usePageTitle } from "../hooks/usePageTitle";

type Severity = "critical" | "high" | "medium" | "low";
type Tone = "red" | "amber" | "emerald" | "brand" | "slate";

interface ExecutiveKpi {
  label: string;
  value: string;
  sublabel: string;
  why: string;
  tone: Tone;
  href: string;
  icon: React.ElementType;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  invertTrend?: boolean;
}

interface PriorityItem {
  id: string;
  title: string;
  severity: Severity;
  impact: string;
  action: string;
  href: string;
  icon: React.ElementType;
}

interface InsightItem {
  id: string;
  title: string;
  body: string;
  confidence: "High" | "Medium";
  href: string;
  icon: React.ElementType;
}

const toneClasses: Record<Tone, { border: string; bg: string; text: string; iconBg: string }> = {
  red: {
    border: "border-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
    iconBg: "bg-red-100",
  },
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  emerald: {
    border: "border-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  brand: {
    border: "border-brand-500",
    bg: "bg-brand-50",
    text: "text-brand-700",
    iconBg: "bg-brand-100",
  },
  slate: {
    border: "border-surface-400",
    bg: "bg-surface-50",
    text: "text-surface-700",
    iconBg: "bg-surface-100",
  },
};

const severityClasses: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value: string | number | null | undefined, suffix = "") {
  if (value == null || value === "") return "-";
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `${parsed.toFixed(1)}${suffix}`;
}

function riskBadge(level: string | null) {
  if (!level) return null;
  const cls: Record<string, string> = {
    low: "risk-low",
    medium: "risk-medium",
    high: "risk-high",
    critical: "risk-critical",
  };
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  return <span className={`badge ${cls[level] || ""}`}>{labels[level] || level}</span>;
}

function scoreColor(score: number | null) {
  if (score == null) return "text-surface-400";
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-brand-600";
  if (score >= 4) return "text-amber-600";
  return "text-red-600";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getShortlistRiskDistribution(stats: DashboardOverview) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const supplier of stats.topSuppliers ?? []) {
    const level = supplier.current_risk_level?.toLowerCase();
    if (level === "critical" || level === "high" || level === "medium" || level === "low") {
      counts[level] += 1;
    } else {
      counts.unknown += 1;
    }
  }
  return counts;
}

function buildExecutiveKpis(stats: DashboardOverview): ExecutiveKpi[] {
  const vs = stats.vsLastMonth;
  const avgPerformance = Number(stats.avgPerformanceScore ?? 0);
  const riskDelta = vs?.riskChange ?? null;
  const performanceDelta = vs?.performanceChange ?? null;
  const esgCoverage = stats.totalSuppliers > 0 ? Math.round((stats.esg.total / stats.totalSuppliers) * 100) : 0;
  const documentExposure = stats.expiringDocsCount;

  return [
    {
      label: "Portfolio Health",
      value: formatScore(stats.avgPerformanceScore, "/10"),
      sublabel: `${formatNumber(stats.activeSuppliers)} active of ${formatNumber(stats.totalSuppliers)} suppliers`,
      why: "Executive read on supplier performance momentum.",
      tone: avgPerformance >= 7 ? "emerald" : avgPerformance >= 4 ? "amber" : "red",
      href: "/performance",
      icon: BarChart3,
      trend: performanceDelta == null ? "No trend" : `${performanceDelta > 0 ? "+" : ""}${performanceDelta} MoM`,
      trendDirection: performanceDelta == null ? "flat" : performanceDelta > 0 ? "up" : performanceDelta < 0 ? "down" : "flat",
    },
    {
      label: "High/Critical Risk",
      value: formatNumber(stats.highRiskCount),
      sublabel: "suppliers require executive visibility",
      why: "Highlights suppliers that can disrupt continuity or compliance.",
      tone: stats.highRiskCount > 0 ? "red" : "emerald",
      href: "/risks",
      icon: ShieldAlert,
      trend: riskDelta == null ? "No trend" : `${riskDelta > 0 ? "+" : ""}${riskDelta} MoM`,
      trendDirection: riskDelta == null ? "flat" : riskDelta > 0 ? "up" : riskDelta < 0 ? "down" : "flat",
      invertTrend: true,
    },
    {
      label: "Document Exposure",
      value: formatNumber(documentExposure),
      sublabel: "documents expiring within 30 days",
      why: "Prevents supplier qualification and audit readiness gaps.",
      tone: documentExposure > 0 ? "amber" : "emerald",
      href: "/suppliers",
      icon: FileWarning,
      trend: documentExposure > 0 ? "Action needed" : "Clear",
      trendDirection: documentExposure > 0 ? "up" : "flat",
      invertTrend: true,
    },
    {
      label: "ESG Readiness",
      value: `${esgCoverage}%`,
      sublabel: `${formatNumber(stats.esg.total)} suppliers assessed`,
      why: "Shows how complete the sustainability evidence base is.",
      tone: esgCoverage >= 80 ? "emerald" : esgCoverage >= 50 ? "amber" : "red",
      href: "/esg",
      icon: Leaf,
      trend: `${formatScore(stats.esg.avg_esg, "/100")} avg ESG`,
      trendDirection: "flat",
    },
    {
      label: "Governance Coverage",
      value: formatNumber(stats.esgBands.compliant),
      sublabel: "compliant ESG assessments",
      why: "Signals policy alignment before supplier decisions scale.",
      tone: stats.esgBands.non_compliant > 0 ? "amber" : "brand",
      href: "/compliance",
      icon: ShieldCheck,
      trend: `${formatNumber(stats.esgBands.non_compliant)} non-compliant`,
      trendDirection: stats.esgBands.non_compliant > 0 ? "up" : "flat",
      invertTrend: true,
    },
  ];
}

function buildPriorities(stats: DashboardOverview): PriorityItem[] {
  const priorities: PriorityItem[] = [];
  const shortlistRiskCounts = getShortlistRiskDistribution(stats);

  if (stats.highRiskCount > 0) {
    priorities.push({
      id: "risk-exposure",
      title: `${stats.highRiskCount} suppliers at high or critical risk`,
      severity: shortlistRiskCounts.critical > 0 || stats.highRiskCount >= 5 ? "critical" : "high",
      impact: "Continuity, compliance, and executive escalation exposure",
      action: "Review risk drivers and mitigation owners",
      href: "/risks",
      icon: ShieldAlert,
    });
  }

  if (stats.expiringDocsCount > 0) {
    priorities.push({
      id: "document-exposure",
      title: `${stats.expiringDocsCount} supplier documents expire within 30 days`,
      severity: stats.expiringDocsCount >= 5 ? "high" : "medium",
      impact: "Qualification and audit readiness gap",
      action: "Open supplier records and request refreshed evidence",
      href: "/suppliers",
      icon: FileWarning,
    });
  }

  for (const supplier of (stats.decliningSuppliers ?? []).slice(0, 3)) {
    priorities.push({
      id: `declining-${supplier.id}`,
      title: `${supplier.name} performance dropped ${supplier.previous_score.toFixed(1)} to ${supplier.latest_score.toFixed(1)}`,
      severity: supplier.latest_score < 4 ? "high" : "medium",
      impact: "Supplier health trend is moving against target",
      action: "Inspect score history and start supplier recovery discussion",
      href: `/suppliers/${supplier.id}`,
      icon: TrendingDown,
    });
  }

  if (stats.esg.total > 0 && stats.esgBands.non_compliant > 0) {
    priorities.push({
      id: "esg-gap",
      title: `${stats.esgBands.non_compliant} suppliers are non-compliant on ESG`,
      severity: "medium",
      impact: "Sustainability and reporting readiness risk",
      action: "Prioritize evidence review and corrective actions",
      href: "/esg",
      icon: Leaf,
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      id: "healthy-portfolio",
      title: "No urgent executive supplier actions detected",
      severity: "low",
      impact: "Portfolio is clear against V1 deterministic checks",
      action: "Continue monitoring risk, ESG, performance, and document freshness",
      href: "/activity",
      icon: CheckCircle2,
    });
  }

  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return priorities.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 6);
}

function buildInsights(stats: DashboardOverview): InsightItem[] {
  const insights: InsightItem[] = [];
  const vs = stats.vsLastMonth;
  const performanceDelta = vs?.performanceChange ?? null;
  const riskDelta = vs?.riskChange ?? null;
  const esgCoverage = stats.totalSuppliers > 0 ? Math.round((stats.esg.total / stats.totalSuppliers) * 100) : 0;
  const lowPerfCount = stats.performanceBands.low;

  if ((riskDelta ?? 0) > 0 && (performanceDelta ?? 0) < 0) {
    insights.push({
      id: "risk-up-performance-down",
      title: "Risk is rising while performance is weakening",
      body: `High-risk suppliers increased by ${riskDelta} while average performance moved ${performanceDelta}. This is the highest-priority executive pattern.`,
      confidence: "High",
      href: "/risks",
      icon: AlertTriangle,
    });
  }

  if (esgCoverage < 70) {
    insights.push({
      id: "esg-coverage",
      title: "ESG evidence coverage is below enterprise threshold",
      body: `${esgCoverage}% of suppliers have ESG assessment coverage. Increase coverage before using ESG readiness as a portfolio control.`,
      confidence: "High",
      href: "/esg",
      icon: Leaf,
    });
  }

  if (stats.expiringDocsCount > 0) {
    insights.push({
      id: "document-expiry",
      title: "Document freshness can create hidden onboarding friction",
      body: `${stats.expiringDocsCount} documents expire within 30 days. Treat renewals as a supplier enablement queue, not only an audit task.`,
      confidence: "High",
      href: "/suppliers",
      icon: Clock,
    });
  }

  if (lowPerfCount > 0) {
    insights.push({
      id: "low-performance-band",
      title: "Performance bands reveal recovery candidates",
      body: `${lowPerfCount} suppliers are in the low performance band. Pair the list with risk level before deciding escalation.`,
      confidence: "Medium",
      href: "/performance",
      icon: TrendingDown,
    });
  }

  if (stats.topSuppliers.length > 0 && stats.highRiskCount > 0) {
    insights.push({
      id: "supplier-concentration",
      title: "Top suppliers should be reviewed through risk and contract context",
      body: "Use the supplier ranking as the executive shortlist, then drill into risk, performance, ESG, and contract coverage before intervention.",
      confidence: "Medium",
      href: "/spend",
      icon: HandCoins,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "stable-portfolio",
      title: "Portfolio signals are stable in the current scope",
      body: "No deterministic V1 intelligence rules crossed an escalation threshold. Continue monitoring trend movement and evidence freshness.",
      confidence: "High",
      href: "/activity",
      icon: Activity,
    });
  }

  return insights.slice(0, 5);
}

function ExecutiveKpiCard({ item }: { item: ExecutiveKpi }) {
  const Icon = item.icon;
  const TrendIcon =
    item.trendDirection === "up" ? TrendingUp : item.trendDirection === "down" ? TrendingDown : Activity;
  const tone = toneClasses[item.tone];
  const trendGood =
    item.trendDirection === "flat" ||
    (item.trendDirection === "up" && !item.invertTrend) ||
    (item.trendDirection === "down" && item.invertTrend);
  const trendClass = trendGood ? "text-emerald-700" : "text-red-600";

  return (
    <Link
      to={item.href}
      className={`glass-card group block p-4 border-l-4 ${tone.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone.iconBg} ${tone.text} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-surface-300 transition group-hover:text-brand-600" />
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-400">{item.label}</p>
        <p className="mt-1 text-3xl font-semibold text-surface-950">{item.value}</p>
        <p className="mt-1 text-xs text-surface-500">{item.sublabel}</p>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <p className="text-xs leading-snug text-surface-600">{item.why}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${trendClass}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {item.trend}
        </span>
      </div>
    </Link>
  );
}

function ExecutivePriorities({ items }: { items: PriorityItem[] }) {
  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between gap-3 border-b border-white/50 px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-950">Executive Priorities</h2>
          <p className="mt-1 text-xs text-surface-500">Severity-ranked actions generated from current portfolio signals.</p>
        </div>
        <SlidersHorizontal className="h-5 w-5 text-brand-600" />
      </div>
      <div className="divide-y divide-surface-100">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.id} to={item.href} className="group grid gap-3 px-5 py-4 transition hover:bg-white/45 md:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-700">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${severityClasses[item.severity]}`}>
                      {item.severity}
                    </span>
                    <p className="truncate text-sm font-semibold text-surface-950">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">{item.impact}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <p className="text-xs font-medium text-brand-700">{item.action}</p>
                <ArrowRight className="h-4 w-4 shrink-0 text-surface-300 transition group-hover:text-brand-600" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function IntelligenceSnapshot({ items }: { items: InsightItem[] }) {
  return (
    <div className="glass-panel">
      <div className="border-b border-white/50 px-5 py-4">
        <h2 className="font-display text-base font-semibold text-surface-950">Intelligence Snapshot</h2>
        <p className="mt-1 text-xs text-surface-500">Explainable V1 rules. No black-box scoring.</p>
      </div>
      <div className="space-y-3 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.id} to={item.href} className="group block rounded-lg border border-white/60 bg-white/45 p-3 transition hover:border-brand-200 hover:bg-brand-50/70">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-950">{item.title}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-surface-500">
                      {item.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-surface-600">{item.body}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SupplierRanking({ stats }: { stats: DashboardOverview }) {
  const navigate = useNavigate();
  const topSuppliers = stats.topSuppliers ?? [];

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between border-b border-white/50 px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-950">Supplier Executive Shortlist</h2>
          <p className="mt-1 text-xs text-surface-500">Top suppliers with risk, performance, ESG, and contract context.</p>
        </div>
        <Link to="/suppliers" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        {topSuppliers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-400">No shortlisted suppliers match the selected filters.</p>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-white/35 text-[11px] uppercase tracking-[0.12em] text-surface-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Supplier</th>
                <th className="px-3 py-3 text-left font-semibold">Risk</th>
                <th className="px-3 py-3 text-right font-semibold">Performance</th>
                <th className="px-3 py-3 text-right font-semibold">ESG</th>
                <th className="px-5 py-3 text-right font-semibold">Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {topSuppliers.map((supplier, index) => (
                <tr
                  key={supplier.id}
                  className="cursor-pointer transition hover:bg-white/45"
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-100 text-xs font-semibold text-surface-500">
                        {index + 1}
                      </span>
                      <span className="max-w-[260px] truncate font-medium text-surface-950">{supplier.name ?? "Unnamed supplier"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">{riskBadge(supplier.current_risk_level)}</td>
                  <td className={`px-3 py-3.5 text-right font-semibold tabular-nums ${scoreColor(supplier.latest_score)}`}>
                    {supplier.latest_score != null ? supplier.latest_score.toFixed(1) : <EmptyValue />}
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium tabular-nums text-surface-700">
                    {supplier.overall_esg_score != null ? supplier.overall_esg_score.toFixed(0) : <EmptyValue />}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums text-surface-700">
                    {supplier.contract_count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecentActivity({ stats }: { stats: DashboardOverview }) {
  const recentActivities = stats.recentActivities ?? [];

  return (
    <div className="glass-panel">
      <div className="border-b border-white/50 px-5 py-4">
        <h2 className="font-display text-base font-semibold text-surface-950">Recent Activity</h2>
        <p className="mt-1 text-xs text-surface-500">Operational evidence behind portfolio movement.</p>
      </div>
      <div>
        {recentActivities.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-400">No activity yet.</p>
        ) : (
          <div className="divide-y divide-surface-100">
            {recentActivities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="px-5 py-3.5">
                <p className="text-sm leading-snug text-surface-700">{activity.description}</p>
                <p className="mt-1 text-xs text-surface-400">{timeAgo(activity.performed_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full rounded-md" />
        </div>
        <Skeleton className="hidden h-10 w-32 rounded-lg md:block" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-surface-200 bg-white p-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="mt-4 h-8 w-24 rounded" />
            <Skeleton className="mt-3 h-3 w-full rounded" />
            <Skeleton className="mt-2 h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-lg xl:col-span-2" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  usePageTitle("Dashboard");

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: {
      industry: "all",
      riskLevel: [] as string[],
      segment: "all",
    },
    debounceKeys: [],
  });

  const dashboardIndustry =
    filters.industry && filters.industry !== "all" ? (filters.industry as string) : undefined;

  const {
    data: stats,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.dashboard(dashboardIndustry),
    queryFn: () => fetchDashboardStats(dashboardIndustry),
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

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
    {
      key: "riskLevel",
      type: "multiselect",
      placeholder: "All risk levels",
      options: [
        { value: "critical", label: "Critical" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      minWidth: "160px",
    },
    {
      key: "segment",
      type: "select",
      options: [
        { value: "all", label: "All segments" },
        { value: "strategic", label: "Strategic suppliers" },
        { value: "watchlist", label: "Watchlist" },
        { value: "compliance", label: "Compliance focus" },
      ],
      minWidth: "170px",
    },
  ];

  const shortlistedStats = useMemo(() => {
    if (!stats) return null;
    const selectedRiskLevels = ((filters.riskLevel as string[]) ?? []).map((value) => value.toLowerCase());
    const segment = (filters.segment as string) ?? "all";

    const topSuppliers = stats.topSuppliers.filter((supplier) => {
      const riskLevel = supplier.current_risk_level?.toLowerCase() ?? "low";
      const riskMatch = selectedRiskLevels.length === 0 || selectedRiskLevels.includes(riskLevel);
      const segmentMatch =
        segment === "all" ||
        (segment === "strategic" && (supplier.contract_count ?? 0) >= 2) ||
        (segment === "watchlist" && (riskLevel === "high" || riskLevel === "critical" || (supplier.latest_score ?? 10) < 4)) ||
        (segment === "compliance" && (supplier.overall_esg_score == null || supplier.overall_esg_score < 60));
      return riskMatch && segmentMatch;
    });

    return { ...stats, topSuppliers };
  }, [filters.riskLevel, filters.segment, stats]);

  const executiveKpis = useMemo(() => (stats ? buildExecutiveKpis(stats) : []), [stats]);
  const priorities = useMemo(() => (stats ? buildPriorities(stats) : []), [stats]);
  const insights = useMemo(() => (stats ? buildInsights(stats) : []), [stats]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
        Error: {error}
      </div>
    );
  }

  if (!stats || !shortlistedStats) return null;

  return (
    <div className="dashboard-shell space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Enterprise SRM Intelligence</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-surface-950">Executive Command Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-surface-600">
            CPO-level view of supplier health, risk exposure, ESG readiness, and action priorities.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/55 px-3 py-2 text-xs text-surface-500 shadow-sm">
          <Clock className="h-4 w-4 text-brand-600" />
          Data freshness follows dashboard overview sync
        </div>
      </div>

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
        onReset={resetFilters}
        activeCount={activeCount}
        resultCount={shortlistedStats.topSuppliers.length}
        resultLabel="shortlisted suppliers"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {executiveKpis.map((item) => (
          <div key={item.label}>
            <ExecutiveKpiCard item={item} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <ExecutivePriorities items={priorities} />
          <SupplierRanking stats={shortlistedStats} />
        </div>
        <div className="space-y-5">
          <PortfolioHealthWidget stats={stats} />
          <IntelligenceSnapshot items={insights} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="glass-panel p-5 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-surface-950">Product Notes</h2>
              <p className="mt-1 text-xs text-surface-500">Enterprise capabilities recommended beyond V1 scope.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Saved executive views by role and business unit",
              "Action owners, due dates, and SLA tracking",
              "Alert acknowledgements with audit history",
              "Board-ready export and share workflows",
            ].map((note) => (
              <div key={note} className="rounded-lg border border-white/60 bg-white/45 px-3 py-2 text-sm text-surface-700">
                {note}
              </div>
            ))}
          </div>
        </div>
        <RecentActivity stats={stats} />
      </div>
    </div>
  );
}
