import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeEsgScores,
  createEsgAssessment,
  getEsgBySupplier,
  getEsgHotspots,
  getEsgLeaderboard,
  getEsgSummary,
} from "./esg.service";
import type { EsgAssessmentCreate } from "./esg.schema";
import * as repo from "./esg.repository";

vi.mock("./esg.repository", () => ({
  fetchApprovedAssessmentRowsForSummary: vi.fn(),
  fetchAssessmentHistoryBySupplier: vi.fn(),
  fetchEsgPortfolioSummaryFromRPC: vi.fn(),
  fetchLatestAssessmentBySupplier: vi.fn(),
  fetchLeaderboardAssessmentRows: vi.fn(),
  insertEsgAssessmentRecord: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY: EsgAssessmentCreate = {
  period: "2024-Q1",
  status: "draft",
  env_certifications: [],
  social_certifications: [],
  gov_certifications: [],
};

const FULL_GOOD: EsgAssessmentCreate = {
  period: "2024-Q1",
  status: "approved",
  // Environmental — high scores
  renewable_energy_pct: 80,
  waste_recycling_pct: 70,
  carbon_footprint_tons: 100,   // score = max(0, 100 - 100/10) = 90
  water_usage_m3: 5000,
  env_certifications: ["ISO14001", "CDP"],
  // Social — high scores
  women_in_mgmt_pct: 50,
  lost_time_injury_rate: 0.5,   // score = max(0, 100 - 0.5*20) = 90
  living_wage_compliant: true,
  child_labor_policy: true,
  social_certifications: ["ISO45001"],
  // Governance — all true
  anti_corruption_policy: true,
  independent_audit: true,
  gdpr_compliant: true,
  data_breach_incidents: 0,     // score = max(0, 100 - 0*25) = 100
  gov_certifications: ["ISO27001"],
};

const FULL_BAD: EsgAssessmentCreate = {
  period: "2024-Q1",
  status: "draft",
  renewable_energy_pct: 0,
  waste_recycling_pct: 0,
  carbon_footprint_tons: 10000, // score = max(0, 100 - 10000/10) = 0
  env_certifications: [],
  women_in_mgmt_pct: 0,
  lost_time_injury_rate: 10,    // score = max(0, 100 - 10*20) = 0
  living_wage_compliant: false,
  child_labor_policy: false,
  social_certifications: [],
  anti_corruption_policy: false,
  independent_audit: false,
  gdpr_compliant: false,
  data_breach_incidents: 4,     // score = max(0, 100 - 4*25) = 0
  gov_certifications: [],
};

// ── computeEsgScores ──────────────────────────────────────────────────────────

describe("computeEsgScores", () => {

  // ── All-null input ──────────────────────────────────────────────────────────

  it("returns all zeros when no metrics are provided", () => {
    const result = computeEsgScores(EMPTY);
    expect(result.env_score).toBe(0);
    expect(result.social_score).toBe(0);
    expect(result.gov_score).toBe(0);
    expect(result.overall_esg_score).toBe(0);
  });

  // ── Weighted overall ───────────────────────────────────────────────────────

  it("overall = env*0.50 + social*0.20 + gov*0.30 (rounded)", () => {
    const { env_score, social_score, gov_score, overall_esg_score } =
      computeEsgScores(FULL_GOOD);
    const expected = Math.round(env_score * 0.50 + social_score * 0.20 + gov_score * 0.30);
    expect(overall_esg_score).toBe(expected);
  });

  it("overall score is always between 0 and 100", () => {
    const good = computeEsgScores(FULL_GOOD);
    const bad = computeEsgScores(FULL_BAD);
    expect(good.overall_esg_score).toBeGreaterThanOrEqual(0);
    expect(good.overall_esg_score).toBeLessThanOrEqual(100);
    expect(bad.overall_esg_score).toBeGreaterThanOrEqual(0);
    expect(bad.overall_esg_score).toBeLessThanOrEqual(100);
  });

  // ── Environmental ─────────────────────────────────────────────────────────

  it("env: carbon_footprint_tons=0 gives carbon score of 100", () => {
    const result = computeEsgScores({ ...EMPTY, carbon_footprint_tons: 0 });
    // avg([100]) + certBonus(0) = 100
    expect(result.env_score).toBe(100);
  });

  it("env: carbon_footprint_tons=1000 clamps score to 0 (not negative)", () => {
    const result = computeEsgScores({ ...EMPTY, carbon_footprint_tons: 1000 });
    // score = max(0, 100 - 1000/10) = max(0, -900) = 0
    // points = [0, certBonus=0] → avg = 0
    expect(result.env_score).toBe(0);
  });

  it("env: certification bonus caps at 20 (4+ certs)", () => {
    const result = computeEsgScores({
      ...EMPTY,
      renewable_energy_pct: 60,
      env_certifications: ["ISO14001", "CDP", "GRI", "EMAS", "FSC"], // 5 × 5 = 25 → capped at 20
    });
    // avg([60]) + min(20, 25) = 60 + 20 = 80
    expect(result.env_score).toBe(80);
  });

  it("env: renewable_energy_pct=100 and waste_recycling_pct=100 gives high score", () => {
    const result = computeEsgScores({
      ...EMPTY,
      renewable_energy_pct: 100,
      waste_recycling_pct: 100,
    });
    // avg([100, 100]) + 0 = 100
    expect(result.env_score).toBe(100);
  });

  it("env: strong metrics + cert bonus is additive and capped at pillar 100", () => {
    const result = computeEsgScores({
      ...EMPTY,
      renewable_energy_pct: 100,
      waste_recycling_pct: 100,
      carbon_footprint_tons: 0,
      env_certifications: ["ISO14001", "CDP", "GRI", "EMAS"],
    });
    // avg([100,100,100]) + 20 → min(100, 120) = 100
    expect(result.env_score).toBe(100);
  });

  it("env: only certifications provided (no numeric metrics) → score is 0", () => {
    // certBonus only pushed if points.length > 0 already — so no numeric = 0
    const result = computeEsgScores({
      ...EMPTY,
      env_certifications: ["ISO14001"],
    });
    expect(result.env_score).toBe(0);
  });

  // ── Social ────────────────────────────────────────────────────────────────

  it("social: lost_time_injury_rate=0 → injury score = 100", () => {
    const result = computeEsgScores({ ...EMPTY, lost_time_injury_rate: 0 });
    // avg([100]) + certBonus(0) = 100
    expect(result.social_score).toBe(100);
  });

  it("social: lost_time_injury_rate=5 clamps to 0", () => {
    const result = computeEsgScores({ ...EMPTY, lost_time_injury_rate: 5 });
    // score = max(0, 100 - 5*20) = 0
    // points = [0, certBonus=0] → 0
    expect(result.social_score).toBe(0);
  });

  it("social: living_wage_compliant=true adds 100", () => {
    const r1 = computeEsgScores({ ...EMPTY, living_wage_compliant: true });
    const r2 = computeEsgScores({ ...EMPTY, living_wage_compliant: false });
    expect(r1.social_score).toBeGreaterThan(r2.social_score);
  });

  it("social: living_wage_compliant=null is ignored (not counted)", () => {
    const withNull = computeEsgScores({ ...EMPTY, living_wage_compliant: null });
    const withTrue = computeEsgScores({ ...EMPTY, living_wage_compliant: true });
    // null: no metric points → 0; true: avg([100]) + 0 = 100
    expect(withNull.social_score).toBe(0);
    expect(withTrue.social_score).toBe(100);
  });

  it("social: all metrics perfect → high social score", () => {
    const result = computeEsgScores({
      ...EMPTY,
      women_in_mgmt_pct: 50,
      lost_time_injury_rate: 0,
      living_wage_compliant: true,
      child_labor_policy: true,
      social_certifications: ["ISO45001", "SA8000"],
    });
    expect(result.social_score).toBeGreaterThan(60);
  });

  // ── Governance ────────────────────────────────────────────────────────────

  it("gov: all policies true + no breaches → high gov score", () => {
    const result = computeEsgScores({
      ...EMPTY,
      anti_corruption_policy: true,
      independent_audit: true,
      gdpr_compliant: true,
      data_breach_incidents: 0,
      gov_certifications: ["ISO27001"],
    });
    expect(result.gov_score).toBeGreaterThan(70);
  });

  it("gov: data_breach_incidents=4 → breach score = 0", () => {
    const result = computeEsgScores({
      ...EMPTY,
      data_breach_incidents: 4,
    });
    // score = max(0, 100 - 4*25) = 0 → points = [0, certBonus=0] → 0
    expect(result.gov_score).toBe(0);
  });

  it("gov: anti_corruption_policy=false → pushes 0", () => {
    const withFalse = computeEsgScores({ ...EMPTY, anti_corruption_policy: false });
    const withNull  = computeEsgScores({ ...EMPTY });
    // false adds 0 as sole metric → avg 0; null → no metrics → 0
    expect(withFalse.gov_score).toBe(0);
    expect(withNull.gov_score).toBe(0);
  });

  it("gov: certification bonus caps at 20", () => {
    const result = computeEsgScores({
      ...EMPTY,
      anti_corruption_policy: true,
      gov_certifications: ["ISO27001", "SOC2", "ISO37001", "GDPR", "PCI"],
    });
    // avg([100]) + min(20, 25) = 120 → clamped to 100
    expect(result.gov_score).toBe(100);
  });

  // ── Return shape ──────────────────────────────────────────────────────────

  it("always returns all four keys", () => {
    const result = computeEsgScores(EMPTY);
    expect(result).toHaveProperty("env_score");
    expect(result).toHaveProperty("social_score");
    expect(result).toHaveProperty("gov_score");
    expect(result).toHaveProperty("overall_esg_score");
  });

  it("all returned scores are integers (Math.round applied)", () => {
    const result = computeEsgScores(FULL_GOOD);
    expect(Number.isInteger(result.env_score)).toBe(true);
    expect(Number.isInteger(result.social_score)).toBe(true);
    expect(Number.isInteger(result.gov_score)).toBe(true);
    expect(Number.isInteger(result.overall_esg_score)).toBe(true);
  });

  // ── Full good vs full bad ─────────────────────────────────────────────────

  it("FULL_GOOD scores higher than FULL_BAD across all pillars", () => {
    const good = computeEsgScores(FULL_GOOD);
    const bad  = computeEsgScores(FULL_BAD);
    expect(good.env_score).toBeGreaterThan(bad.env_score);
    expect(good.social_score).toBeGreaterThan(bad.social_score);
    expect(good.gov_score).toBeGreaterThan(bad.gov_score);
    expect(good.overall_esg_score).toBeGreaterThan(bad.overall_esg_score);
  });
});

describe("getEsgSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed shape when RPC total is 0", async () => {
    vi.mocked(repo.fetchEsgPortfolioSummaryFromRPC).mockResolvedValue({
      total: 0,
      avg_esg: null,
      avg_env: null,
      avg_social: null,
      avg_gov: null,
      avg_renewable_energy_pct: null,
      avg_waste_recycling_pct: null,
      avg_carbon_footprint_tons: null,
      avg_water_usage_m3: null,
      avg_women_in_mgmt_pct: null,
      avg_lost_time_injury_rate: null,
      living_wage_pct: null,
      child_labor_policy_pct: null,
      anti_corruption_pct: null,
      independent_audit_pct: null,
      gdpr_compliant_pct: null,
      avg_data_breach_incidents: null,
    });

    const result = await getEsgSummary();
    expect(result.total).toBe(0);
    expect(result.avg_esg).toBe(0);
    expect(result.social_metrics.living_wage_compliant_pct).toBeNull();
  });

  it("throws when RPC query fails", async () => {
    vi.mocked(repo.fetchEsgPortfolioSummaryFromRPC).mockRejectedValue(new Error("rpc failed"));
    await expect(getEsgSummary()).rejects.toThrow("rpc failed");
  });
});

describe("createEsgAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes scores and forwards payload to insert", async () => {
    vi.mocked(repo.insertEsgAssessmentRecord).mockResolvedValue({ id: "assess-1" });

    await createEsgAssessment("sup-1", "user-1", FULL_GOOD);

    expect(repo.insertEsgAssessmentRecord).toHaveBeenCalledOnce();
    const inserted = vi.mocked(repo.insertEsgAssessmentRecord).mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.supplier_id).toBe("sup-1");
    expect(inserted.assessed_by).toBe("user-1");
    expect(inserted.overall_esg_score).toBeDefined();
    expect(inserted.env_score).toBeDefined();
    expect(inserted.social_score).toBeDefined();
    expect(inserted.gov_score).toBeDefined();
  });
});

describe("getEsgLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes rows by supplier_id and preserves ranking order", async () => {
    vi.mocked(repo.fetchLeaderboardAssessmentRows).mockResolvedValue([
      {
        supplier_id: "s1",
        overall_esg_score: 90,
        env_score: 92,
        social_score: 88,
        gov_score: 89,
        env_certifications: [],
        social_certifications: [],
        gov_certifications: [],
        assessment_date: "2026-01-10",
        srm_suppliers: { name: "A", industry: "Auto" },
      },
      {
        supplier_id: "s1",
        overall_esg_score: 85,
        env_score: 84,
        social_score: 86,
        gov_score: 85,
        env_certifications: [],
        social_certifications: [],
        gov_certifications: [],
        assessment_date: "2025-12-10",
        srm_suppliers: { name: "A", industry: "Auto" },
      },
      {
        supplier_id: "s2",
        overall_esg_score: 80,
        env_score: 82,
        social_score: 78,
        gov_score: 79,
        env_certifications: [],
        social_certifications: [],
        gov_certifications: [],
        assessment_date: "2026-01-08",
        srm_suppliers: { name: "B", industry: null },
      },
    ]);

    const result = await getEsgLeaderboard();
    expect(result).toHaveLength(2);
    expect(result[0].supplier_id).toBe("s1");
    expect(result[1].supplier_id).toBe("s2");
  });
});

describe("getEsgBySupplier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest assessment from repository", async () => {
    vi.mocked(repo.fetchLatestAssessmentBySupplier).mockResolvedValue({
      id: "row-1",
      supplier_id: "sup-1",
      period: "2026-Q1",
    });
    const result = await getEsgBySupplier("sup-1");
    expect(repo.fetchLatestAssessmentBySupplier).toHaveBeenCalledWith("sup-1");
    expect(result).toMatchObject({
      id: "row-1",
      supplier_id: "sup-1",
      period: "2026-Q1",
      narrative: expect.any(String),
    });
  });
});

describe("getEsgHotspots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when no approved rows", async () => {
    vi.mocked(repo.fetchApprovedAssessmentRowsForSummary).mockResolvedValue([]);
    const result = await getEsgHotspots();
    expect(result).toEqual([]);
  });
});
