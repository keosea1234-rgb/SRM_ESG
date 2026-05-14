import type { EsgSummary } from "../../services/esg";

interface Props {
  summary: EsgSummary;
}

const BENCHMARKS = [
  { label: "Renewable Energy", oursKey: "avg_renewable_energy_pct", peer: 45, leader: 85 },
  { label: "Waste Recycling", oursKey: "avg_waste_recycling_pct", peer: 55, leader: 80 },
  { label: "Women in Mgmt", oursKey: "avg_women_in_mgmt_pct", peer: 38, leader: 52 },
  { label: "Living Wage", oursKey: "living_wage_compliant_pct", peer: 74, leader: 100 },
  { label: "GDPR Compliant", oursKey: "gdpr_compliant_pct", peer: 82, leader: 100 },
  { label: "Anti-Corruption", oursKey: "anti_corruption_policy_pct", peer: 70, leader: 100 },
] as const;

function oursValue(summary: EsgSummary, key: string): number | null {
  const raw =
    (summary.env_metrics as unknown as Record<string, unknown>)[key] ??
    (summary.social_metrics as unknown as Record<string, unknown>)[key] ??
    (summary.gov_metrics as unknown as Record<string, unknown>)[key] ??
    null;

  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function BarColumn({
  value,
  fillClass,
}: {
  value: number | null;
  fillClass: string;
}) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-medium w-8 text-right tabular-nums shrink-0">
        {value == null ? "—" : Math.round(pct)}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden min-w-0">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ESGIndustryBenchmark({ summary }: Props) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-surface-900">Industry benchmark</h2>
        <div className="flex flex-wrap gap-4 text-xs text-surface-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-600" /> Ours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-surface-300" /> Peer avg
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Leader
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {BENCHMARKS.map((b) => {
          const ours = oursValue(summary, b.oursKey);
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs text-surface-500 w-28 shrink-0">{b.label}</span>
              <div className="flex-1 flex gap-2 min-w-0">
                <BarColumn value={ours} fillClass="bg-brand-600" />
                <BarColumn value={b.peer} fillClass="bg-surface-300" />
                <BarColumn value={b.leader} fillClass="bg-emerald-400" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
