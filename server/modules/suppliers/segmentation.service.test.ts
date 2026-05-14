import { describe, expect, it } from "vitest";
import { classifySupplier, type SupplierSummaryRowForSegmentation } from "./segmentation.service";

function baseRow(overrides: Partial<SupplierSummaryRowForSegmentation> = {}): SupplierSummaryRowForSegmentation {
  return {
    id: "sup-1",
    latest_performance_score: 7.5,
    current_risk_level: "medium",
    contract_count: 1,
    overall_esg_score: 65,
    esg_trend_delta_90d: 0,
    overall_score: 78,
    is_single_source: false,
    ...overrides,
  };
}

describe("classifySupplier", () => {
  it("classifies at_risk when health is below 4", () => {
    const result = classifySupplier(baseRow({ latest_performance_score: 2.5, current_risk_level: "critical" }));
    expect(result[0]).toBe("at_risk");
  });

  it("classifies esg_laggard for low ESG score", () => {
    const result = classifySupplier(baseRow({ overall_esg_score: 35 }));
    expect(result[0]).toBe("esg_laggard");
  });

  it("classifies strategic when health high and contract count >= 2", () => {
    const result = classifySupplier(baseRow({ latest_performance_score: 9, current_risk_level: "low", contract_count: 3 }));
    expect(result[0]).toBe("strategic");
  });

  it("classifies high_performer when health >= 7 and performance >= 75", () => {
    const result = classifySupplier(baseRow({ latest_performance_score: 8, current_risk_level: "low", overall_score: 82 }));
    expect(result).toContain("high_performer");
  });

  it("classifies watch when health band is watchlist", () => {
    const result = classifySupplier(baseRow({ latest_performance_score: 4.8, current_risk_level: "high", overall_esg_score: null, overall_score: 55 }));
    expect(result[0]).toBe("watch");
  });

  it("classifies single_source when supplier is only source category", () => {
    const result = classifySupplier(baseRow({ is_single_source: true }));
    expect(result).toContain("single_source");
  });

  it("falls back to standard when no segment matches", () => {
    const result = classifySupplier(baseRow({ latest_performance_score: null, overall_score: null, overall_esg_score: null }));
    expect(result).toContain("standard");
  });
});
