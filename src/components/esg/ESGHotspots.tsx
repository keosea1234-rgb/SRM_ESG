import type { HotspotMetric } from "../../services/esg";

interface Props {
  hotspots: HotspotMetric[];
}

const INVERTED_KEYS = new Set([
  "carbon_footprint_tons",
  "lost_time_injury_rate",
  "data_breach_incidents",
]);

const PILLAR_BADGE: Record<"E" | "S" | "G", string> = {
  E: "bg-blue-100 text-blue-700",
  S: "bg-purple-100 text-purple-700",
  G: "bg-amber-100 text-amber-700",
};

function formatAvg(metric: HotspotMetric): string {
  if (metric.avg == null) return "—";
  const u = metric.unit.trim();
  if (u === "%") return `${Math.round(metric.avg)}%`;
  if (u === "t") return `${metric.avg.toFixed(1)} t`;
  return `${metric.avg.toFixed(1)}${u ? ` ${u}` : ""}`;
}

function barWidthPct(metric: HotspotMetric): number {
  const { avg, target } = metric;
  if (avg == null || target === 0) {
    if (metric.key === "data_breach_incidents" && avg != null) {
      return Math.min(100, avg > 0 ? 100 : 0);
    }
    return 0;
  }
  return Math.min(100, (avg / target) * 100);
}

function barFillClass(metric: HotspotMetric): string {
  const inverted = INVERTED_KEYS.has(metric.key);
  const avg = metric.avg;
  const target = metric.target;

  if (avg == null) return "bg-surface-300";

  if (inverted) {
    return avg > target ? "bg-red-400" : "bg-emerald-400";
  }
  return avg < target ? "bg-red-400" : "bg-emerald-400";
}

export default function ESGHotspots({ hotspots }: Props) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-surface-900">Hotspots</h2>
        <p className="text-xs text-surface-400 mt-0.5">
          Weakest metrics across the portfolio — below target
        </p>
      </div>

      {hotspots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50/50 px-4 py-8 text-center text-sm text-surface-400">
          No hotspot data
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {hotspots.map((m) => (
            <div
              key={m.key}
              className="bg-white rounded-xl border border-surface-200 p-4 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PILLAR_BADGE[m.pillar]}`}>
                  {m.pillar}
                </span>
                <span className="text-xs text-surface-500 leading-tight">{m.label}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900">{formatAvg(m)}</p>
                <p className="text-xs text-surface-400 mt-1">
                  {m.below_target_count} suppliers affected
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden mt-auto">
                <div
                  className={`h-full rounded-full transition-all ${barFillClass(m)}`}
                  style={{ width: `${barWidthPct(m)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
