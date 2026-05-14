interface ESGScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  /** Scale for ring fill (default 100 for ESG % scores). Use 10 for 0–10 performance scores. */
  maxScore?: number;
}

export default function ESGScoreRing({
  score,
  size = 80,
  strokeWidth = 8,
  color,
  maxScore = 100,
}: ESGScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), maxScore) / maxScore) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-lg font-bold text-surface-900">{score}</span>
    </div>
  );
}
