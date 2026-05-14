import { describe, it, expect } from "vitest";
import {
  gradeFromScore,
  pctDisplayToScore,
  normalizePct,
  normalizeCarbon,
  normalizeInjuryRate,
  normalizeBoolean,
  normalizeDataBreaches,
  gradeEnvMetrics,
  gradeSocialMetrics,
  gradeGovMetrics,
} from "./esgGrading";

describe("gradeFromScore", () => {
  it("returns null for null input", () => {
    expect(gradeFromScore(null)).toBeNull();
  });

  it.each([
    [100, "A"],
    [80, "A"],
    [79, "B"],
    [65, "B"],
    [64, "C"],
    [50, "C"],
    [49, "D"],
    [35, "D"],
    [34, "F"],
    [0, "F"],
  ] as [number, string][])("score %d → grade %s", (score, grade) => {
    expect(gradeFromScore(score)!.grade).toBe(grade);
  });

  it("returns the correct label for each grade", () => {
    expect(gradeFromScore(90)!.label).toBe("Excellent");
    expect(gradeFromScore(70)!.label).toBe("Good");
    expect(gradeFromScore(55)!.label).toBe("Average");
    expect(gradeFromScore(40)!.label).toBe("Below Average");
    expect(gradeFromScore(10)!.label).toBe("Poor");
  });

  it("score is rounded in result", () => {
    expect(gradeFromScore(79.7)!.score).toBe(80);
  });
});

describe("pctDisplayToScore", () => {
  it("returns null for null/undefined", () => {
    expect(pctDisplayToScore(null)).toBeNull();
    expect(pctDisplayToScore(undefined)).toBeNull();
  });

  it("returns null for '—'", () => {
    expect(pctDisplayToScore("—")).toBeNull();
  });

  it("parses '75%' → 75", () => {
    expect(pctDisplayToScore("75%")).toBe(75);
  });

  it("parses '100' (no percent sign) → 100", () => {
    expect(pctDisplayToScore("100")).toBe(100);
  });

  it("clamps to 100 for values above 100", () => {
    expect(pctDisplayToScore("150%")).toBe(100);
  });

  it("clamps to 0 for negative values (edge case)", () => {
    expect(pctDisplayToScore("-10%")).toBe(0);
  });

  it("returns null for non-numeric strings", () => {
    expect(pctDisplayToScore("abc")).toBeNull();
  });
});

describe("normalizePct", () => {
  it("returns null for null", () => {
    expect(normalizePct(null)).toBeNull();
  });
  it("clamps 0-100", () => {
    expect(normalizePct(50)).toBe(50);
    expect(normalizePct(110)).toBe(100);
    expect(normalizePct(-5)).toBe(0);
  });
});

describe("normalizeCarbon", () => {
  it("returns null for null", () => {
    expect(normalizeCarbon(null)).toBeNull();
  });
  it("0 tons → 100", () => expect(normalizeCarbon(0)).toBe(100));
  it("1000 tons → 0", () => expect(normalizeCarbon(1000)).toBe(0));
  it("10000 tons clamps to 0 (not negative)", () => expect(normalizeCarbon(10000)).toBe(0));
  it("500 tons → 50", () => expect(normalizeCarbon(500)).toBe(50));
});

describe("normalizeInjuryRate", () => {
  it("returns null for null", () => {
    expect(normalizeInjuryRate(null)).toBeNull();
  });
  it("0 → 100", () => expect(normalizeInjuryRate(0)).toBe(100));
  it("5 → 0", () => expect(normalizeInjuryRate(5)).toBe(0));
  it("10 clamps to 0", () => expect(normalizeInjuryRate(10)).toBe(0));
  it("2.5 → 50", () => expect(normalizeInjuryRate(2.5)).toBe(50));
});

describe("normalizeBoolean", () => {
  it("returns null for null", () => {
    expect(normalizeBoolean(null)).toBeNull();
  });
  it("true → 100", () => expect(normalizeBoolean(true)).toBe(100));
  it("false → 0", () => expect(normalizeBoolean(false)).toBe(0));
});

describe("normalizeDataBreaches", () => {
  it("returns null for null", () => {
    expect(normalizeDataBreaches(null)).toBeNull();
  });
  it("0 → 100", () => expect(normalizeDataBreaches(0)).toBe(100));
  it("4 → 0", () => expect(normalizeDataBreaches(4)).toBe(0));
  it("10 clamps to 0", () => expect(normalizeDataBreaches(10)).toBe(0));
  it("2 → 50", () => expect(normalizeDataBreaches(2)).toBe(50));
});

describe("gradeEnvMetrics", () => {
  it("grades all three metrics", () => {
    const result = gradeEnvMetrics({
      renewable_energy_pct: 80,
      waste_recycling_pct: 60,
      carbon_footprint_tons: 200,
    });
    expect(result.renewable_energy!.grade).toBe("A");
    expect(result.waste_recycling!.grade).toBe("C");
    // 100 - 200/10 = 80 → grade A
    expect(result.carbon_footprint!.grade).toBe("A");
  });

  it("returns null grades for null inputs", () => {
    const result = gradeEnvMetrics({
      renewable_energy_pct: null,
      waste_recycling_pct: null,
      carbon_footprint_tons: null,
    });
    expect(result.renewable_energy).toBeNull();
    expect(result.waste_recycling).toBeNull();
    expect(result.carbon_footprint).toBeNull();
  });
});

describe("gradeSocialMetrics", () => {
  it("grades all four metrics", () => {
    const result = gradeSocialMetrics({
      women_in_mgmt_pct: 90,
      lost_time_injury_rate: 0,
      living_wage_compliant: true,
      child_labor_policy: false,
    });
    expect(result.women_in_mgmt!.grade).toBe("A");
    expect(result.injury_rate!.grade).toBe("A");
    expect(result.living_wage!.grade).toBe("A");
    expect(result.child_labor_policy!.grade).toBe("F");
  });
});

describe("gradeGovMetrics", () => {
  it("grades all four metrics", () => {
    const result = gradeGovMetrics({
      anti_corruption_policy: true,
      independent_audit: false,
      gdpr_compliant: true,
      data_breach_incidents: 0,
    });
    expect(result.anti_corruption!.grade).toBe("A");
    expect(result.independent_audit!.grade).toBe("F");
    expect(result.gdpr!.grade).toBe("A");
    expect(result.data_breaches!.grade).toBe("A");
  });

  it("returns null for null inputs", () => {
    const result = gradeGovMetrics({
      anti_corruption_policy: null,
      independent_audit: null,
      gdpr_compliant: null,
      data_breach_incidents: null,
    });
    expect(result.anti_corruption).toBeNull();
    expect(result.data_breaches).toBeNull();
  });
});
