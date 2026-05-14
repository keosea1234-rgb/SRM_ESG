import ESGScoreRing from "./ESGScoreRing";
import type { GradeResult } from "../lib/esgGrading";

export interface Metric {
  label: string;
  value: string | number | null;
  grade?: GradeResult | null;
  displayOnly?: boolean;
}

interface ESGPillarCardProps {
  pillar: "E" | "S" | "G";
  score: number;
  metrics: Metric[];
  certifications: string[];
  /** When true, shows a pillar-colored ring (leaderboard drill-through). */
  selected?: boolean;
  /** Clicking the header toggles leaderboard filter / sort for this pillar. */
  onHeaderClick?: () => void;
}

const PILLAR_CONFIG = {
  E: {
    label: "Environmental",
    color: "#0369a1",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
    ring: "ring-blue-400",
  },
  S: {
    label: "Social",
    color: "#7c3aed",
    bg: "bg-purple-50",
    badge: "bg-purple-100 text-purple-800",
    ring: "ring-purple-400",
  },
  G: {
    label: "Governance",
    color: "#b45309",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    ring: "ring-amber-400",
  },
};

export default function ESGPillarCard({
  pillar,
  score,
  metrics,
  certifications,
  selected = false,
  onHeaderClick,
}: ESGPillarCardProps) {
  const cfg = PILLAR_CONFIG[pillar];
  const cardRing = selected ? `ring-2 ${cfg.ring} ring-offset-2` : "";

  return (
    <div
      className={`bg-white rounded-xl border border-surface-200 p-5 flex flex-col gap-4 transition-shadow ${cardRing}`}
    >
      {onHeaderClick ? (
        <button
          type="button"
          onClick={onHeaderClick}
          aria-pressed={selected}
          title={`Sort leaderboard by ${cfg.label} score (click again to clear)`}
          className={`flex w-full items-center justify-between gap-3 rounded-lg -m-1 p-1 text-left transition-colors hover:bg-surface-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${selected ? "bg-surface-50/50" : ""}`}
        >
          <div className="min-w-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {pillar}
            </span>
            <h3 className="mt-1 text-sm font-semibold text-surface-900">{cfg.label}</h3>
          </div>
          <ESGScoreRing score={score} color={cfg.color} />
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {pillar}
            </span>
            <h3 className="mt-1 text-sm font-semibold text-surface-900">{cfg.label}</h3>
          </div>
          <ESGScoreRing score={score} color={cfg.color} />
        </div>
      )}

      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between items-center text-sm py-1">
            <span className="text-surface-500">{m.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-surface-800">{m.value ?? "—"}</span>
              {m.grade && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${m.grade.bg} ${m.grade.color}`}>
                  {m.grade.grade}
                </span>
              )}
              {m.displayOnly && (
                <span className="text-xs text-surface-300 border border-surface-200 px-1.5 py-0.5 rounded">
                  —
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-surface-100">
          {certifications.map((cert) => (
            <span key={cert} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cert}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
