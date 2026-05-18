import { describe, expect, it } from "vitest";
import {
  findWgiPoliticalStabilityRisk,
  scorePoliticalStabilityPercentile,
} from "./riskFactorUpload";

const csv = `Data Source,Worldwide Governance Indicators

"Country Name","Country Code","Indicator Name","Indicator Code","2022","2023","2024"
"Turkiye","TUR","Political Stability and Absence of Violence/Terrorism: Percentile Rank","PV.PER.RNK","15.1","18.4",""
"Germany","DEU","Political Stability and Absence of Violence/Terrorism: Percentile Rank","PV.PER.RNK","75.0","82.4","83.1"`;

describe("riskFactorUpload", () => {
  it("maps political stability percentile to a 1-5 geopolitical risk score", () => {
    expect(scorePoliticalStabilityPercentile(85)).toBe(1);
    expect(scorePoliticalStabilityPercentile(65)).toBe(2);
    expect(scorePoliticalStabilityPercentile(45)).toBe(3);
    expect(scorePoliticalStabilityPercentile(25)).toBe(4);
    expect(scorePoliticalStabilityPercentile(10)).toBe(5);
  });

  it("finds the latest non-empty WGI value by supplier country name", () => {
    const result = findWgiPoliticalStabilityRisk(csv, "Turkiye");
    expect(result).toMatchObject({
      countryCode: "TUR",
      year: "2023",
      percentile: 18.4,
      geopoliticalRisk: 5,
    });
  });

  it("matches by ISO country code too", () => {
    const result = findWgiPoliticalStabilityRisk(csv, "DEU");
    expect(result).toMatchObject({
      countryName: "Germany",
      year: "2024",
      geopoliticalRisk: 1,
    });
  });
});
