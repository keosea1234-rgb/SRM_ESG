/**
 * PortfolioHealthWidget — 2×2 grid (right side of dashboard)
 */
import type { DashboardOverview } from "../services/dashboard";

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function buildArcData(
  segments: { value: number; color: string }[],
  cx: number, cy: number, r: number
): { d: string; color: string }[] {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return [];
  const gap = 2.5;
  const paths: { d: string; color: string }[] = [];
  let startAngle = -90;
  for (const seg of segments) {
    const pct = seg.value / total;
    const sweep = pct * 360 - gap;
    if (sweep <= 0) { startAngle += pct * 360; continue; }
    const s = toRad(startAngle);
    const e = toRad(startAngle + sweep);
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    paths.push({ d: `M ${x1} ${y1} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`, color: seg.color });
    startAngle += pct * 360;
  }
  return paths;
}

interface DonutProps {
  segments: { label: string; value: number; color: string }[];
  label: string;
  sub?: string;
}

function DonutChart({ segments, label, sub }: DonutProps) {
  const size = 96, sw = 13, cx = size / 2, cy = size / 2, r = (size - sw) / 2;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const arcs = buildArcData(segments, cx, cy, r);
  return (
    <div className="flex flex-col items-center gap-2 w-full h-full justify-center py-3 px-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
          : <>
              {arcs.map((arc, i) => <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={sw} strokeLinecap="butt" />)}
              <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill="#111827">{total}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#9ca3af">suppliers</text>
            </>
        }
      </svg>
      <div className="text-center">
        <p className="text-xs font-semibold text-surface-800 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-surface-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-surface-600 truncate max-w-[80px]">{seg.label}</span>
            </div>
            <span className="text-surface-500 font-medium flex-shrink-0">
              {seg.value}{total > 0 && <span className="text-surface-400 font-normal"> ({((seg.value / total) * 100).toFixed(0)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GaugeProps { score: number; band: string; evalCount: number; totalCount: number; }

function HealthGauge({ score, band, evalCount, totalCount }: GaugeProps) {
  const W = 200, H = 118, cx = W / 2, cy = H - 8, R = 76, SW = 14;

  function semiArc(startFrac: number, endFrac: number, gapDeg = 2) {
    const s = toRad(180 + startFrac * 180 + gapDeg / 2);
    const e = toRad(180 + endFrac   * 180 - gapDeg / 2);
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
    return `M ${x1} ${y1} A ${R} ${R} 0 ${(endFrac - startFrac) * 180 > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  }

  const arcBands = [
    { frac: [0, 0.15],    color: "#ef4444" },
    { frac: [0.15, 0.30], color: "#f97316" },
    { frac: [0.30, 0.50], color: "#eab308" },
    { frac: [0.50, 0.70], color: "#10b981" },
    { frac: [0.70, 0.85], color: "#059669" },
    { frac: [0.85, 1.00], color: "#16a34a" },
  ];

  const frac = Math.min(1, Math.max(0, score / 10));
  const nRad = toRad(180 + frac * 180);
  const nLen = R - SW / 2 - 2;
  const nx = cx + nLen * Math.cos(nRad), ny = cy + nLen * Math.sin(nRad);

  function nColor(s: number) {
    if (s >= 8.5) return "#16a34a"; if (s >= 7) return "#059669";
    if (s >= 5)   return "#10b981"; if (s >= 3) return "#eab308";
    if (s >= 1.5) return "#f97316"; return "#ef4444";
  }
  const nc = nColor(score);

  return (
    <div className="flex flex-col items-center gap-1 w-full h-full justify-center py-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        {arcBands.map((b, i) => (
          <path key={i} d={semiArc(b.frac[0], b.frac[1])} fill="none" stroke={b.color} strokeWidth={SW} strokeLinecap="butt" />
        ))}
        {/* scale labels */}
        {[0, 5, 10].map((v) => {
          const deg = 180 + (v / 10) * 180;
          const lx = cx + (R + SW / 2 + 9) * Math.cos(toRad(deg));
          const ly = cy + (R + SW / 2 + 9) * Math.sin(toRad(deg));
          return <text key={v} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#9ca3af">{v}</text>;
        })}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={nc} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={nc} />
        <circle cx={cx} cy={cy} r={2.5} fill="white" />
        {/* score */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="22" fontWeight="800" fill={nc}>{score.toFixed(1)}</text>
        <text x={cx} y={cy - 2}  textAnchor="middle" fontSize="9"  fontWeight="600" fill="#374151">{band}</text>
      </svg>
      <p className="text-xs font-semibold text-surface-800 -mt-1">Overall Health Score</p>
      <p className="text-[10px] text-surface-400">{evalCount} / {totalCount} suppliers evaluated</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
        {[{ label: "At Risk", color: "#ef4444" }, { label: "Watchlist", color: "#eab308" }, { label: "Healthy", color: "#10b981" }, { label: "Excellent", color: "#16a34a" }].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-surface-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioHealthWidget({ stats }: { stats: DashboardOverview }) {
  const suppliers   = stats.topSuppliers ?? [];
  const avgScore    = stats.avgPerformanceScore ? parseFloat(stats.avgPerformanceScore) : null;
  const pb          = stats.performanceBands;
  const esg         = stats.esg ?? { avg_esg: 0, avg_env: 0, avg_social: 0, avg_gov: 0, total: 0 };
  const eb          = stats.esgBands;

  const perfSegments = [
    { label: "High Perf.", value: pb.high,   color: "#16a34a" },
    { label: "Medium",     value: pb.medium, color: "#3b82f6" },
    { label: "Low Perf.",  value: pb.low,    color: "#d1d5db" },
  ];

  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of suppliers) {
    const lvl = (s.current_risk_level ?? "low").toLowerCase();
    if (lvl in riskCounts) riskCounts[lvl as keyof typeof riskCounts]++;
    else riskCounts.low++;
  }
  const riskSegments = [
    { label: "Critical", value: riskCounts.critical, color: "#ef4444" },
    { label: "High",     value: riskCounts.high,     color: "#f97316" },
    { label: "Medium",   value: riskCounts.medium,   color: "#eab308" },
    { label: "Low",      value: riskCounts.low,      color: "#22c55e" },
  ];

  const esgSegments = [
    { label: "Compliant",     value: eb.compliant,     color: "#16a34a" },
    { label: "Developing",    value: eb.developing,    color: "#93c5fd" },
    { label: "Non-compliant", value: eb.non_compliant, color: "#f87171" },
  ];

  const perfScore   = avgScore ?? 0;
  const riskFactor  = suppliers.length > 0
    ? suppliers.reduce((acc, s) => acc + ({ low: 10, medium: 7, high: 4, critical: 0 }[(s.current_risk_level ?? "medium").toLowerCase()] ?? 5), 0) / suppliers.length
    : 5;
  const esgFactor   = esg.avg_esg > 0 ? esg.avg_esg / 10 : null;
  const rawHealth   = esgFactor != null ? perfScore * 0.4 + esgFactor * 0.4 + riskFactor * 0.2 : perfScore * 0.6 + riskFactor * 0.4;
  const health      = Math.min(10, Math.max(0, Math.round(rawHealth * 10) / 10));
  const healthBand  = (s: number) => s >= 8 ? "Excellent" : s >= 6 ? "Healthy" : s >= 4 ? "Watchlist" : "At Risk";
  const evalCount   = suppliers.filter((s) => s.latest_score != null).length;

  return (
    <div className="grid grid-cols-2 gap-px bg-surface-100 rounded-xl overflow-hidden border border-surface-200 h-full">
      {/* TOP-LEFT */}
      <div className="bg-white flex flex-col">
        <div className="px-4 py-2 border-b border-surface-100">
          <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">Overall Health</p>
        </div>
        <HealthGauge score={health} band={healthBand(health)} evalCount={evalCount} totalCount={stats.totalSuppliers} />
      </div>

      {/* TOP-RIGHT */}
      <div className="bg-white flex flex-col">
        <div className="px-4 py-2 border-b border-surface-100">
          <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">Risk Distribution</p>
        </div>
        <DonutChart segments={riskSegments} label="Risk Distribution" sub={`${riskCounts.critical} critical supplier${riskCounts.critical !== 1 ? "s" : ""}`} />
      </div>

      {/* BOTTOM-LEFT */}
      <div className="bg-white flex flex-col">
        <div className="px-4 py-2 border-b border-surface-100">
          <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">ESG Compliance</p>
        </div>
        <DonutChart segments={esgSegments} label="ESG Compliance" sub="Based on latest assessments" />
      </div>

      {/* BOTTOM-RIGHT */}
      <div className="bg-white flex flex-col">
        <div className="px-4 py-2 border-b border-surface-100">
          <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">Supplier Performance</p>
        </div>
        <DonutChart segments={perfSegments} label="Supplier Performance" sub={avgScore != null ? `Avg: ${avgScore.toFixed(1)} / 10` : ""} />
      </div>
    </div>
  );
}
