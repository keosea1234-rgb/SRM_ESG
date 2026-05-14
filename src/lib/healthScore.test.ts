import { describe, it, expect } from "vitest";
import { calcHealthScore, healthBandFromScore } from "./healthScore";

describe("calcHealthScore", () => {
  it("returns null when performanceScore is null", () => {
    expect(calcHealthScore(null, "low")).toBeNull();
  });

  it("returns null when performanceScore is NaN", () => {
    expect(calcHealthScore(NaN, "low")).toBeNull();
  });

  // ── Without ESG (fallback formula: perf*0.6 + risk*0.4) ──────────────────

  it("no-ESG: perf=10 low risk → Excellent", () => {
    const result = calcHealthScore(10, "low");
    expect(result).not.toBeNull();
    expect(result!.band).toBe("Excellent");
    expect(result!.score).toBeGreaterThanOrEqual(8);
  });

  it("no-ESG: perf=0 critical risk → At Risk", () => {
    const result = calcHealthScore(0, "critical");
    expect(result!.band).toBe("At Risk");
    expect(result!.score).toBeLessThan(4);
  });

  it("no-ESG: unknown riskLevel defaults to 5 (medium-ish)", () => {
    const r1 = calcHealthScore(7, null);
    const r2 = calcHealthScore(7, "unknown_level");
    expect(r1!.score).toBe(r2!.score);
  });

  it("no-ESG: performance score on 0-100 scale is normalised to 0-10", () => {
    const from100 = calcHealthScore(80, "low");
    const from10 = calcHealthScore(8, "low");
    expect(from100!.score).toBe(from10!.score);
  });

  // ── With ESG (overall_esg_score 0–100 → esgNorm = score/10) ──────────────

  it("with-ESG: overall_esg_score=100 → esgNorm=10; uses perf*0.4 + esg*0.4 + risk*0.2", () => {
    const result = calcHealthScore(10, "low", 100);
    expect(result!.band).toBe("Excellent");
    expect(result!.score).toBe(10);
    expect(result!.breakdown.esgNorm).toBe(10);
  });

  it("overall_esg_score=75 → esgNorm=7.5 (aligned with ESG leaderboard scale)", () => {
    const result = calcHealthScore(10, "low", 75);
    expect(result!.breakdown.esgNorm).toBe(7.5);
    expect(result!.breakdown.hasEsg).toBe(true);
  });

  it("with-ESG: breakdown.hasEsg is true", () => {
    const result = calcHealthScore(8, "medium", 70);
    expect(result!.breakdown.hasEsg).toBe(true);
    expect(result!.breakdown.esgNorm).toBe(7);
  });

  it("without-ESG: breakdown.hasEsg is false and esgNorm is null", () => {
    const result = calcHealthScore(8, "medium");
    expect(result!.breakdown.hasEsg).toBe(false);
    expect(result!.breakdown.esgNorm).toBeNull();
  });

  // ── Ceilings ──────────────────────────────────────────────────────────────

  it("ceiling: critical risk caps score at 4.0", () => {
    const result = calcHealthScore(10, "critical", 100);
    expect(result!.score).toBeLessThanOrEqual(4.0);
    expect(result!.band).toBe("Watchlist");
  });

  it("ceiling: esgNorm < 1.0 caps score at 4.0 (overall_esg_score=5)", () => {
    const result = calcHealthScore(10, "low", 5);
    expect(result!.breakdown.esgNorm).toBe(0.5);
    expect(result!.score).toBeLessThanOrEqual(4.0);
  });

  it("ceiling: 1.0 <= esgNorm < 2.0 caps score at 6.0 (overall_esg_score=15)", () => {
    const result = calcHealthScore(10, "low", 15);
    expect(result!.breakdown.esgNorm).toBe(1.5);
    expect(result!.score).toBeLessThanOrEqual(6.0);
    expect(result!.score).toBeGreaterThan(4.0);
  });

  it("ceiling: esgNorm >= 2.0 — no esg ceiling applied (overall_esg_score=30)", () => {
    const noCapResult = calcHealthScore(10, "low", 30);
    expect(noCapResult!.breakdown.esgNorm).toBe(3);
    expect(noCapResult!.score).toBeGreaterThan(6.0);
  });

  // ── Bands ─────────────────────────────────────────────────────────────────

  it("score >= 8 → Excellent", () => {
    expect(calcHealthScore(10, "low")!.band).toBe("Excellent");
  });

  it("score in [6,8) → Healthy", () => {
    expect(calcHealthScore(7, "medium")!.band).toBe("Healthy");
  });

  it("score in [4,6) → Watchlist", () => {
    expect(calcHealthScore(5, "high")!.band).toBe("Watchlist");
  });

  it("score < 4 → At Risk (without critical ceiling)", () => {
    expect(calcHealthScore(1, "high")!.band).toBe("At Risk");
  });

  // ── Score precision ───────────────────────────────────────────────────────

  it("score is rounded to 1 decimal place", () => {
    const result = calcHealthScore(7.3, "medium");
    const decimals = result!.score.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});

describe("healthBandFromScore", () => {
  it.each([
    [8, "Excellent"],
    [10, "Excellent"],
    [6, "Healthy"],
    [7.9, "Healthy"],
    [4, "Watchlist"],
    [5.9, "Watchlist"],
    [0, "At Risk"],
    [3.9, "At Risk"],
  ] as [number, string][])("score %d → %s", (score, expected) => {
    expect(healthBandFromScore(score)).toBe(expected);
  });
});
