import { describe, expect, it } from "vitest";
import {
  buildNarrativeFromData,
  deriveTrendDirection,
  generateEsgNarrative,
  type NarrativeSignal,
} from "./narrative.service";

describe("narrative.service", () => {
  it("generateEsgNarrative highlights governance with breach and audit drivers", () => {
    const text = generateEsgNarrative({
      env_score: 72,
      social_score: 68,
      gov_score: 44,
      data_breach_incidents: 3,
      independent_audit: false,
      gdpr_compliant: true,
      anti_corruption_policy: true,
    });
    expect(text.toLowerCase()).toContain("governance");
    expect(text).toMatch(/44/);
    expect(text.toLowerCase()).toContain("breach");
    expect(text.toLowerCase()).toContain("independent audit");
  });

  it("creates high ESG decline signal when drop is greater than 10", () => {
    const narrative = buildNarrativeFromData({
      supplierId: "sup-1",
      esgHistory: [
        { overall_esg_score: 62, env_score: 63, social_score: 60, gov_score: 54, assessment_date: "2026-01-01" },
        { overall_esg_score: 46, env_score: 60, social_score: 55, gov_score: 41, assessment_date: "2026-04-01" },
      ],
      riskHistory: [],
      performanceTrend: null,
      expiringDocs: [],
      latestEsg: null,
      recentActivity: [],
    });

    const esgSignal = narrative.signals.find((s) => s.type === "esg_decline");
    expect(esgSignal?.severity).toBe("high");
    expect(esgSignal?.message.toLowerCase()).toContain("governance");
  });

  it("adds risk increase signal for critical level with delta", () => {
    const narrative = buildNarrativeFromData({
      supplierId: "sup-2",
      esgHistory: [],
      riskHistory: [
        { overall_risk_level: "critical", assessment_date: "2026-05-01" },
        { overall_risk_level: "high", assessment_date: "2026-04-01" },
      ],
      performanceTrend: null,
      expiringDocs: [],
      latestEsg: null,
      recentActivity: [],
    });

    const riskSignal = narrative.signals.find((s) => s.type === "risk_increase");
    expect(riskSignal?.severity).toBe("high");
    expect(riskSignal?.delta).toBe(1);
  });

  it("emits performance drop and positive trend based on score delta thresholds", () => {
    const dropNarrative = buildNarrativeFromData({
      supplierId: "sup-3",
      esgHistory: [],
      riskHistory: [],
      performanceTrend: { score_delta: -1.2 },
      expiringDocs: [],
      latestEsg: null,
      recentActivity: [],
    });
    expect(dropNarrative.signals.some((s) => s.type === "performance_drop")).toBe(true);

    const positiveNarrative = buildNarrativeFromData({
      supplierId: "sup-3",
      esgHistory: [],
      riskHistory: [],
      performanceTrend: { score_delta: 1.5 },
      expiringDocs: [],
      latestEsg: null,
      recentActivity: [],
    });
    expect(positiveNarrative.signals.some((s) => s.type === "positive_trend")).toBe(true);
  });

  it("creates cert expiring signal when documents expire in 30 days", () => {
    const narrative = buildNarrativeFromData({
      supplierId: "sup-4",
      esgHistory: [],
      riskHistory: [],
      performanceTrend: null,
      expiringDocs: [
        { id: "d1", expiry_date: "2026-05-18" },
        { id: "d2", expiry_date: "2026-05-22" },
      ],
      latestEsg: null,
      recentActivity: [],
    });

    const expSignal = narrative.signals.find((s) => s.type === "cert_expiring");
    expect(expSignal).toBeTruthy();
    expect(expSignal?.severity).toBe("medium");
  });

  it("detects ESG hotspot for metrics far below target", () => {
    const narrative = buildNarrativeFromData({
      supplierId: "sup-5",
      esgHistory: [],
      riskHistory: [],
      performanceTrend: null,
      expiringDocs: [],
      latestEsg: {
        renewable_energy_pct: 20,
        waste_recycling_pct: 55,
        carbon_footprint_tons: 400,
        women_in_mgmt_pct: 35,
        lost_time_injury_rate: 1,
        living_wage_compliant: true,
        anti_corruption_policy: true,
        independent_audit: true,
        gdpr_compliant: true,
        data_breach_incidents: 0,
      },
      recentActivity: [],
    });

    const hotspot = narrative.signals.find((s) => s.type === "esg_hotspot");
    expect(hotspot).toBeTruthy();
    expect(hotspot?.metric).toBe("renewable_energy_pct");
  });

  it("derives declining direction from negative weighted signals", () => {
    const signals: NarrativeSignal[] = [
      { type: "esg_decline", severity: "high", message: "drop" },
      { type: "risk_increase", severity: "medium", message: "risk up" },
      { type: "positive_trend", severity: "low", message: "up" },
    ];
    const trend = deriveTrendDirection(signals, []);
    expect(trend).toBe("declining");
  });
});
