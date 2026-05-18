import { AlertTriangle, BarChart3, CheckCircle2, Leaf, ShieldAlert } from "lucide-react";
import type { DashboardOverview } from "../services/dashboard";

type HealthBand = "Excellent" | "Healthy" | "Watchlist" | "At Risk";

function formatScore(value: number) {
  return value.toFixed(1);
}

function healthBand(score: number): HealthBand {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Healthy";
  if (score >= 4) return "Watchlist";
  return "At Risk";
}

function healthTone(band: HealthBand) {
  if (band === "Excellent") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (band === "Healthy") return "text-brand-700 bg-brand-50 border-brand-200";
  if (band === "Watchlist") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-surface-700">{label}</span>
        <span className="text-surface-500">
          {value} <span className="text-surface-400">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/60">
        <div className={`animated-bar h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/45 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-400">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-2 text-xl font-semibold text-surface-950">{value}</p>
    </div>
  );
}

export default function PortfolioHealthWidget({ stats }: { stats: DashboardOverview }) {
  const suppliers = stats.topSuppliers ?? [];
  const avgScore = stats.avgPerformanceScore ? parseFloat(stats.avgPerformanceScore) : 0;
  const performanceScore = Number.isFinite(avgScore) ? avgScore : 0;

  const riskFactor =
    suppliers.length > 0
      ? suppliers.reduce((acc, supplier) => {
          const level = (supplier.current_risk_level ?? "medium").toLowerCase();
          const scoreByLevel: Record<string, number> = {
            low: 10,
            medium: 7,
            high: 4,
            critical: 0,
          };
          return acc + (scoreByLevel[level] ?? 5);
        }, 0) / suppliers.length
      : 5;

  const esgFactor = stats.esg.avg_esg > 0 ? stats.esg.avg_esg / 10 : null;
  const rawHealth =
    esgFactor != null
      ? performanceScore * 0.4 + esgFactor * 0.4 + riskFactor * 0.2
      : performanceScore * 0.6 + riskFactor * 0.4;
  const health = Math.min(10, Math.max(0, Math.round(rawHealth * 10) / 10));
  const band = healthBand(health);

  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const supplier of suppliers) {
    const level = (supplier.current_risk_level ?? "low").toLowerCase();
    if (level in riskCounts) riskCounts[level as keyof typeof riskCounts] += 1;
    else riskCounts.low += 1;
  }

  const evaluatedCount = suppliers.filter((supplier) => supplier.latest_score != null).length;
  const esgCoverage = stats.totalSuppliers > 0 ? Math.round((stats.esg.total / stats.totalSuppliers) * 100) : 0;
  const performanceTotal =
    stats.performanceBands.high + stats.performanceBands.medium + stats.performanceBands.low;
  const esgTotal =
    stats.esgBands.compliant + stats.esgBands.developing + stats.esgBands.non_compliant;

  return (
    <div className="glass-panel">
      <div className="border-b border-white/50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-surface-950">Portfolio Health</h2>
            <p className="mt-1 text-xs text-surface-500">Weighted from performance, risk, and ESG readiness.</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthTone(band)}`}>
            {band}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-400">Executive score</p>
            <p className="mt-1 text-5xl font-semibold tracking-normal text-surface-950">{formatScore(health)}</p>
            <p className="mt-1 text-xs text-surface-500">{evaluatedCount} of {stats.totalSuppliers} suppliers evaluated</p>
          </div>
          <div className="h-24 w-24 rounded-full border-[10px] border-lime-200 bg-white/55 p-2 shadow-inner">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white/60 text-sm font-semibold text-brand-800">
              /10
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniMetric label="High risk" value={riskCounts.high + riskCounts.critical} icon={ShieldAlert} tone="text-red-600" />
          <MiniMetric label="ESG coverage" value={`${esgCoverage}%`} icon={Leaf} tone="text-emerald-600" />
          <MiniMetric label="Low perf." value={stats.performanceBands.low} icon={BarChart3} tone="text-amber-600" />
          <MiniMetric label="Clear" value={riskCounts.low} icon={CheckCircle2} tone="text-emerald-600" />
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-white/60 bg-white/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-600" />
              <p className="text-sm font-semibold text-surface-900">Performance Bands</p>
            </div>
            <div className="space-y-3">
              <ProgressBar label="High" value={stats.performanceBands.high} total={performanceTotal} color="bg-emerald-500" />
              <ProgressBar label="Medium" value={stats.performanceBands.medium} total={performanceTotal} color="bg-brand-500" />
              <ProgressBar label="Low" value={stats.performanceBands.low} total={performanceTotal} color="bg-amber-500" />
            </div>
          </div>

          <div className="rounded-lg border border-white/60 bg-white/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-surface-900">ESG Compliance</p>
            </div>
            <div className="space-y-3">
              <ProgressBar label="Compliant" value={stats.esgBands.compliant} total={esgTotal} color="bg-emerald-500" />
              <ProgressBar label="Developing" value={stats.esgBands.developing} total={esgTotal} color="bg-brand-500" />
              <ProgressBar label="Non-compliant" value={stats.esgBands.non_compliant} total={esgTotal} color="bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
