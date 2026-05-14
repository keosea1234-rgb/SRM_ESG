import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./performance.repository", () => ({
  findEvaluationsBySupplier: vi.fn(),
  findEvaluationById: vi.fn(),
  insertEvaluation: vi.fn(),
  updateEvaluation: vi.fn(),
  deleteEvaluation: vi.fn(),
  findLatestEvaluationsAllSuppliers: vi.fn(),
}));

vi.mock("../suppliers/suppliers.repository", () => ({
  insertSupplierActivityLog: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  createEvaluation,
  editEvaluation,
  getEvaluationsForSupplier,
  removeEvaluation,
  getLatestEvaluationsSummary,
} from "./performance.service";
import * as repo from "./performance.repository";

const baseInput = {
  supplier_id: "sup-1",
  evaluation_period: "2024-Q1",
  quality_score: 8,
  delivery_score: 7,
  price_score: 6,
  communication_score: 9,
};

const mockRow = {
  id: "eval-1",
  supplier_id: "sup-1",
  supplier_name: "Acme",
  supplier_code: "ACM001",
  evaluation_period: "2024-Q1",
  quality_score: 8,
  delivery_score: 7,
  price_score: 6,
  communication_score: 9,
  quality_weight: 0.30,
  delivery_weight: 0.25,
  price_weight: 0.25,
  communication_weight: 0.20,
  overall_score: 75,
  notes: null,
  evaluated_by: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("createEvaluation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates evaluation with default weights", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue(mockRow);
    const result = await createEvaluation(baseInput);
    expect(result.id).toBe("eval-1");
    expect(repo.insertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        quality_weight: 0.30,
        delivery_weight: 0.25,
        price_weight: 0.25,
        communication_weight: 0.20,
      })
    );
  });

  it("createEvaluation computes and sets overall_score on insert", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue(mockRow);
    await createEvaluation(baseInput);
    // Math.round((8×0.30 + 7×0.25 + 6×0.25 + 9×0.20) × 10) = Math.round(74.5) = 75
    expect(repo.insertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ overall_score: 75 })
    );
  });

  it("uses custom weights when provided", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue(mockRow);
    await createEvaluation({
      ...baseInput,
      quality_weight: 0.40,
      delivery_weight: 0.30,
      price_weight: 0.20,
      communication_weight: 0.10,
    });
    expect(repo.insertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        quality_weight: 0.40,
        delivery_weight: 0.30,
        price_weight: 0.20,
        communication_weight: 0.10,
      })
    );
  });

  it.each([
    ["quality_score below 0", { ...baseInput, quality_score: -1 }],
    ["quality_score above 10", { ...baseInput, quality_score: 11 }],
    ["delivery_score below 0", { ...baseInput, delivery_score: -0.1 }],
    ["price_score above 10", { ...baseInput, price_score: 10.5 }],
    ["communication_score way above 10", { ...baseInput, communication_score: 100 }],
  ])("%s throws error", async (_, input) => {
    await expect(createEvaluation(input)).rejects.toThrow("must be between 0 and 10");
  });

  it("score of exactly 0 is valid", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue({ ...mockRow, quality_score: 0 });
    await expect(createEvaluation({ ...baseInput, quality_score: 0 })).resolves.toBeDefined();
  });

  it("score of exactly 10 is valid", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue({ ...mockRow, quality_score: 10 });
    await expect(createEvaluation({ ...baseInput, quality_score: 10 })).resolves.toBeDefined();
  });

  it("throws when weights do not sum to 1.00", async () => {
    await expect(
      createEvaluation({
        ...baseInput,
        quality_weight: 0.40,
        delivery_weight: 0.30,
        price_weight: 0.20,
        communication_weight: 0.20,
      })
    ).rejects.toThrow("Weights must sum to 1.00");
  });

  it("accepts weights that sum to 1.00 within float tolerance", async () => {
    vi.mocked(repo.insertEvaluation).mockResolvedValue(mockRow);
    await expect(
      createEvaluation({
        ...baseInput,
        quality_weight: 0.1,
        delivery_weight: 0.2,
        price_weight: 0.3,
        communication_weight: 0.4,
      })
    ).resolves.toBeDefined();
  });

  it("error message includes the actual sum", async () => {
    await expect(
      createEvaluation({
        ...baseInput,
        quality_weight: 0.50,
        delivery_weight: 0.30,
        price_weight: 0.10,
        communication_weight: 0.05,
      })
    ).rejects.toThrow("0.95");
  });
});

describe("editEvaluation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when evaluation not found", async () => {
    vi.mocked(repo.findEvaluationById).mockResolvedValue(null);
    await expect(editEvaluation("nonexistent", {})).rejects.toThrow("Evaluation not found");
  });

  it("editEvaluation recomputes overall_score when scores change", async () => {
    vi.mocked(repo.findEvaluationById).mockResolvedValue(mockRow);
    vi.mocked(repo.updateEvaluation).mockResolvedValue({ ...mockRow, quality_score: 10 });
    await editEvaluation("eval-1", { quality_score: 10 });
    // Math.round((10×0.30 + 7×0.25 + 6×0.25 + 9×0.20) × 10) = Math.round(80.5) = 81 (not 80 — weighted sum is 8.05)
    expect(repo.updateEvaluation).toHaveBeenCalledWith(
      "eval-1",
      expect.objectContaining({ quality_score: 10, overall_score: 81 })
    );
  });

  it("throws when updated score is out of range", async () => {
    vi.mocked(repo.findEvaluationById).mockResolvedValue(mockRow);
    await expect(editEvaluation("eval-1", { quality_score: 15 })).rejects.toThrow(
      "must be between 0 and 10"
    );
  });

  it("throws when merged weights are invalid", async () => {
    vi.mocked(repo.findEvaluationById).mockResolvedValue(mockRow);
    await expect(editEvaluation("eval-1", { quality_weight: 0.99 })).rejects.toThrow(
      "Weights must sum to 1.00"
    );
  });
});

describe("getEvaluationsForSupplier", () => {
  it("returns repository result directly", async () => {
    vi.mocked(repo.findEvaluationsBySupplier).mockResolvedValue([mockRow]);
    const result = await getEvaluationsForSupplier("sup-1");
    expect(result).toEqual([mockRow]);
    expect(repo.findEvaluationsBySupplier).toHaveBeenCalledWith("sup-1");
  });
});

describe("getLatestEvaluationsSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dedupes to one evaluation per supplier — keeps first row per supplier_id (newest first from repo)", async () => {
    vi.mocked(repo.findLatestEvaluationsAllSuppliers).mockResolvedValue({
      data: [
        {
          ...mockRow,
          id: "eval-new",
          supplier_id: "sup-A",
          evaluation_period: "2025-Q1",
          created_at: "2025-01-15T00:00:00Z",
        },
        {
          ...mockRow,
          id: "eval-old",
          supplier_id: "sup-A",
          evaluation_period: "2024-Q4",
          created_at: "2024-10-01T00:00:00Z",
        },
      ],
      error: null,
    } as Awaited<ReturnType<typeof repo.findLatestEvaluationsAllSuppliers>>);

    const result = await getLatestEvaluationsSummary();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("eval-new");
    expect(result.error).toBeNull();
  });

  it("returns one row per distinct supplier when no duplicates", async () => {
    vi.mocked(repo.findLatestEvaluationsAllSuppliers).mockResolvedValue({
      data: [
        { ...mockRow, id: "e1", supplier_id: "sup-A", evaluation_period: "2025-Q1" },
        { ...mockRow, id: "e2", supplier_id: "sup-B", evaluation_period: "2025-Q1" },
      ],
      error: null,
    } as Awaited<ReturnType<typeof repo.findLatestEvaluationsAllSuppliers>>);

    const result = await getLatestEvaluationsSummary();
    expect(result.data).toHaveLength(2);
  });
});

describe("removeEvaluation", () => {
  it("calls deleteEvaluation with correct id", async () => {
    vi.mocked(repo.deleteEvaluation).mockResolvedValue(undefined);
    await removeEvaluation("eval-1");
    expect(repo.deleteEvaluation).toHaveBeenCalledWith("eval-1");
  });
});
