import ESGScoreRing from "../ESGScoreRing";

const PILLAR_NAMES: Record<"E" | "S" | "G", string> = {
  E: "Environmental",
  S: "Social",
  G: "Governance",
};

interface Props {
  pillar: "E" | "S" | "G";
  score: number;
  target: number;
  weight: string;
  color: string;
}

export default function ESGPillarHeader({ pillar, score, target, weight, color }: Props) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: `${color}1A`,
              color,
            }}
          >
            {pillar}
          </span>
          <h3 className="text-sm font-semibold text-surface-900 truncate">{PILLAR_NAMES[pillar]}</h3>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <ESGScoreRing score={score} size={56} strokeWidth={6} color={color} />
          <p className="text-xs text-surface-400 mt-1 text-center">
            target {target} · weight {weight}
          </p>
        </div>
      </div>
    </div>
  );
}
