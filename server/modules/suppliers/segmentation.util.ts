const RISK_SCORES: Record<string, number> = {
  low: 10,
  medium: 7,
  high: 4,
  critical: 0,
};

function performanceOn10(performanceScore: number): number {
  return performanceScore > 10 ? performanceScore / 10 : performanceScore;
}

export function calcHealthScoreLite(
  performanceScore: number | null,
  riskLevel: string | null,
  overallEsgScore: number | null,
): number | null {
  if (performanceScore == null || Number.isNaN(Number(performanceScore))) return null;

  const perf10 = performanceOn10(Number(performanceScore));
  const riskScore = riskLevel ? (RISK_SCORES[riskLevel.toLowerCase()] ?? 5) : 5;

  let esgNorm: number | null = null;
  if (overallEsgScore != null && !Number.isNaN(Number(overallEsgScore))) {
    esgNorm = Number(overallEsgScore) / 10;
  }

  let score =
    esgNorm != null
      ? perf10 * 0.4 + esgNorm * 0.4 + riskScore * 0.2
      : perf10 * 0.6 + riskScore * 0.4;

  const isCritical = riskLevel?.toLowerCase() === "critical";
  if (isCritical) score = Math.min(score, 4.0);
  if (esgNorm != null && esgNorm < 1.0) score = Math.min(score, 4.0);
  if (esgNorm != null && esgNorm >= 1.0 && esgNorm < 2.0) score = Math.min(score, 6.0);
  return Math.round(score * 10) / 10;
}

export function healthBandFromScoreLite(score: number): "Excellent" | "Healthy" | "Watchlist" | "At Risk" {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Healthy";
  if (score >= 4) return "Watchlist";
  return "At Risk";
}
