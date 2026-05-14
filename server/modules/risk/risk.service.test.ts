import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./risk.repository", () => ({
  findAssessmentsBySupplier: vi.fn(),
  findAssessmentById: vi.fn(),
  insertAssessment: vi.fn(),
  updateAssessment: vi.fn(),
  deleteAssessment: vi.fn(),
  findLatestAssessmentsAllSuppliers: vi.fn(),
}));

vi.mock("../suppliers/suppliers.repository", () => ({
  insertSupplierActivityLog: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  createAssessment,
  editAssessment,
  removeAssessment,
  getAssessmentsForSupplier,
  getLatestAssessmentsSummary,
} from "./risk.service";
import * as repo from "./risk.repository";

const baseInput = {
  supplier_id: "sup-1",
  financial_risk: 2,
  operational_risk: 3,
  compliance_risk: 1,
  geopolitical_risk: 4,
  reputational_risk: 2,
};

const mockRow = {
  id: "risk-1",
  supplier_id: "sup-1",
  supplier_name: "Acme",
  supplier_code: "ACM001",
  assessment_date: "2024-01-15",
  financial_risk: 2,
  operational_risk: 3,
  compliance_risk: 1,
  geopolitical_risk: 4,
  reputational_risk: 2,
  overall_risk_level: "medium",
  notes: null,
  assessed_by: null,
  created_at: "2024-01-15T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
};

describe("createAssessment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates assessment with valid input", async () => {
    vi.mocked(repo.insertAssessment).mockResolvedValue(mockRow);
    const result = await createAssessment(baseInput);
    expect(result.id).toBe("risk-1");
    expect(repo.insertAssessment).toHaveBeenCalledOnce();
  });

  it("uses today as assessment_date when not provided", async () => {
    vi.mocked(repo.insertAssessment).mockResolvedValue(mockRow);
    await createAssessment(baseInput);
    const call = vi.mocked(repo.insertAssessment).mock.calls[0][0];
    expect(call.assessment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses provided assessment_date", async () => {
    vi.mocked(repo.insertAssessment).mockResolvedValue(mockRow);
    await createAssessment({ ...baseInput, assessment_date: "2023-06-01" });
    const call = vi.mocked(repo.insertAssessment).mock.calls[0][0];
    expect(call.assessment_date).toBe("2023-06-01");
  });

  it.each([
    ["financial_risk 0 (below min)", { ...baseInput, financial_risk: 0 }],
    ["financial_risk 6 (above max)", { ...baseInput, financial_risk: 6 }],
    ["operational_risk -1", { ...baseInput, operational_risk: -1 }],
    ["compliance_risk 5.5 (not integer)", { ...baseInput, compliance_risk: 5.5 }],
    ["geopolitical_risk 10", { ...baseInput, geopolitical_risk: 10 }],
    ["reputational_risk 0", { ...baseInput, reputational_risk: 0 }],
  ])("%s throws error", async (_, input) => {
    await expect(createAssessment(input)).rejects.toThrow("must be an integer between 1 and 5");
  });

  it("all scores at boundary values (1 and 5) are valid", async () => {
    vi.mocked(repo.insertAssessment).mockResolvedValue(mockRow);
    await expect(
      createAssessment({
        supplier_id: "sup-1",
        financial_risk: 1,
        operational_risk: 5,
        compliance_risk: 1,
        geopolitical_risk: 5,
        reputational_risk: 1,
      })
    ).resolves.toBeDefined();
  });

  it("error message includes the invalid field name", async () => {
    await expect(
      createAssessment({ ...baseInput, compliance_risk: 99 })
    ).rejects.toThrow("compliance_risk");
  });

  it("writes activity log", async () => {
    const { insertSupplierActivityLog } = await import("../suppliers/suppliers.repository");
    vi.mocked(repo.insertAssessment).mockResolvedValue(mockRow);
    await createAssessment(baseInput);
    expect(insertSupplierActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_id: "sup-1", action: "created" })
    );
  });
});

describe("editAssessment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when assessment not found", async () => {
    vi.mocked(repo.findAssessmentById).mockResolvedValue(null);
    await expect(editAssessment("nonexistent", {})).rejects.toThrow("Assessment not found");
  });

  it("partial update — unchanged scores keep existing values", async () => {
    vi.mocked(repo.findAssessmentById).mockResolvedValue(mockRow);
    vi.mocked(repo.updateAssessment).mockResolvedValue({ ...mockRow, financial_risk: 5 });
    const result = await editAssessment("risk-1", { financial_risk: 5 });
    expect(repo.updateAssessment).toHaveBeenCalledWith("risk-1", { financial_risk: 5 });
    expect(result.financial_risk).toBe(5);
  });

  it("throws when updated score is out of range", async () => {
    vi.mocked(repo.findAssessmentById).mockResolvedValue(mockRow);
    await expect(editAssessment("risk-1", { financial_risk: 6 })).rejects.toThrow(
      "must be an integer between 1 and 5"
    );
  });

  it("validates merged values — existing valid + new invalid throws", async () => {
    vi.mocked(repo.findAssessmentById).mockResolvedValue(mockRow);
    await expect(editAssessment("risk-1", { operational_risk: 0 })).rejects.toThrow(
      "operational_risk"
    );
  });
});

describe("removeAssessment", () => {
  it("calls deleteAssessment with correct id", async () => {
    vi.mocked(repo.deleteAssessment).mockResolvedValue(undefined);
    await removeAssessment("risk-1");
    expect(repo.deleteAssessment).toHaveBeenCalledWith("risk-1");
  });
});

describe("getAssessmentsForSupplier", () => {
  it("calls repository with supplier id and returns result", async () => {
    vi.mocked(repo.findAssessmentsBySupplier).mockResolvedValue([mockRow]);
    const result = await getAssessmentsForSupplier("sup-1");
    expect(result).toEqual([mockRow]);
    expect(repo.findAssessmentsBySupplier).toHaveBeenCalledWith("sup-1", { page: 1, limit: 100 });
  });
});

describe("getLatestAssessmentsSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dedupes to one row per supplier — keeps first row per supplier_id (newest first from repo)", async () => {
    vi.mocked(repo.findLatestAssessmentsAllSuppliers).mockResolvedValue({
      data: [
        {
          ...mockRow,
          id: "risk-new",
          supplier_id: "sup-A",
          assessment_date: "2025-01-10",
          overall_risk_level: "low",
        },
        {
          ...mockRow,
          id: "risk-old",
          supplier_id: "sup-A",
          assessment_date: "2024-06-01",
          overall_risk_level: "high",
        },
      ],
      error: null,
    } as Awaited<ReturnType<typeof repo.findLatestAssessmentsAllSuppliers>>);

    const result = await getLatestAssessmentsSummary();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("risk-new");
    expect(result.data![0].assessment_date).toBe("2025-01-10");
    expect(result.error).toBeNull();
  });

  it("returns one row per distinct supplier when no duplicates", async () => {
    vi.mocked(repo.findLatestAssessmentsAllSuppliers).mockResolvedValue({
      data: [
        { ...mockRow, id: "r1", supplier_id: "sup-A", assessment_date: "2025-01-01" },
        { ...mockRow, id: "r2", supplier_id: "sup-B", assessment_date: "2025-02-01" },
      ],
      error: null,
    } as Awaited<ReturnType<typeof repo.findLatestAssessmentsAllSuppliers>>);

    const result = await getLatestAssessmentsSummary();
    expect(result.data).toHaveLength(2);
  });
});
