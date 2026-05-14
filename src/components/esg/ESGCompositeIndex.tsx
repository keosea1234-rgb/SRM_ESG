interface Props {
  score: number;
  total: number;
  target: number;
  vsLastQuarter?: number | null;
  sparklineData?: number[];
}

export default function ESGCompositeIndex({
  score,
  total,
  target,
  vsLastQuarter,
  sparklineData,
}: Props) {
  const points =
    sparklineData && sparklineData.length >= 2
      ? (() => {
          const vals = sparklineData;
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const span = max - min || 1;
          const n = vals.length;
          return vals.map((v, i) => {
            const x = (i / (n - 1)) * 120;
            const y = 40 - ((v - min) / span) * 40;
            return `${x},${y}`;
          });
        })()
      : null;

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <p className="text-5xl font-bold text-surface-900">{score}</p>
        <p className="text-xs text-surface-400 mt-1">
          / 100 · {total} approved suppliers · target {target}
        </p>
        {vsLastQuarter != null && (
          <p
            className={`text-xs font-medium mt-2 ${vsLastQuarter >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {vsLastQuarter >= 0 ? "+" : ""}
            {vsLastQuarter} vs last quarter
          </p>
        )}
      </div>
      {points && (
        <svg viewBox="0 0 120 40" className="shrink-0 w-[120px] h-10" aria-hidden>
          <polyline
            fill="none"
            stroke="#006fa0"
            strokeWidth={1.5}
            points={points.join(" ")}
          />
        </svg>
      )}
    </div>
  );
}
