// Supplier health score: blends performance (0–10), optional ESG overall (0–10), and risk (0–10).
// ESG uses `overall_esg_score` from assessments (0–100), same canonical formula as esg.service.ts → /10 for 0–10 norm.

export type HealthBand = "Excellent" | "Healthy" | "Watchlist" | "At Risk" | "No Data";

export interface HealthScoreBreakdown {
  perf: number | null;
  esgNorm: number | null;
  riskScore: number;
  hasEsg: boolean;
}

interface HealthScore {
  score: number;
  band: HealthBand;
  color: string;
  bgColor: string;
  breakdown: HealthScoreBreakdown;
}

const RISK_SCORES: Record<string, number> = {
  low: 10,
  medium: 7,
  high: 4,
  critical: 0,
};

/** Map API performance (0–100 or 0–10) to a 0–10 scale for the health formula. */
function performanceOn10(performanceScore: number): number {
  return performanceScore > 10 ? performanceScore / 10 : performanceScore;
}

export function calcHealthScore(
  performanceScore: number | null,
  riskLevel: string | null,
  overallEsgScore?: number | null
): HealthScore | null {
  const perfRaw = performanceScore == null ? null : Number(performanceScore);
  if (perfRaw == null || Number.isNaN(perfRaw)) return null;

  const perf10 = performanceOn10(perfRaw);
  const riskScore = riskLevel ? (RISK_SCORES[riskLevel.toLowerCase()] ?? 5) : 5;

  let esgNorm: number | null = null;
  if (overallEsgScore != null) {
    const n = Number(overallEsgScore);
    if (!Number.isNaN(n)) {
      esgNorm = n / 10;
    }
  }
  const hasEsg = esgNorm != null;

  let score = hasEsg
    ? perf10 * 0.4 + esgNorm! * 0.4 + riskScore * 0.2
    : perf10 * 0.6 + riskScore * 0.4;

  const isCritical = riskLevel?.toLowerCase() === "critical";

  // Ceilings — apply in order (each step tightens the cap)
  if (isCritical) {
    score = Math.min(score, 4.0);
  }
  if (esgNorm != null && esgNorm < 1.0) {
    score = Math.min(score, 4.0);
  }
  if (esgNorm != null && esgNorm >= 1.0 && esgNorm < 2.0) {
    score = Math.min(score, 6.0);
  }

  score = Math.round(score * 10) / 10;

  let band: HealthBand;
  let color: string;
  let bgColor: string;

  if (score >= 8) {
    band = "Excellent";
    color = "text-emerald-700";
    bgColor = "bg-emerald-50 border border-emerald-200";
  } else if (score >= 6) {
    band = "Healthy";
    color = "text-green-700";
    bgColor = "bg-green-50 border border-green-200";
  } else if (score >= 4) {
    band = "Watchlist";
    color = "text-amber-700";
    bgColor = "bg-amber-50 border border-amber-200";
  } else {
    band = "At Risk";
    color = "text-red-700";
    bgColor = "bg-red-50 border border-red-200";
  }

  return {
    score,
    band,
    color,
    bgColor,
    breakdown: {
      perf: perf10,
      esgNorm,
      riskScore,
      hasEsg,
    },
  };
}

export function healthBandFromScore(score: number): HealthBand {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Healthy";
  if (score >= 4) return "Watchlist";
  return "At Risk";
}
