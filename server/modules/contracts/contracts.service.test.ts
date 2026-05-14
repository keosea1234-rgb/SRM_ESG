import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./contracts.repository", () => ({
  listContracts: vi.fn(),
  getContractById: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  deleteContract: vi.fn(),
}));

import {
  getContractsService,
  getContractByIdService,
  createContractService,
  updateContractService,
  deleteContractService,
} from "./contracts.service";
import * as repo from "./contracts.repository";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockContract = {
  id: "contract-1",
  title: "Software License Agreement",
  supplier_id: "sup-1",
  supplier_name: "Acme Corp",
  status: "active",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  expiration_date: "2024-12-31",
  contract_size: 50000,
  contract_type: "Software",
  category: "IT",
  owner: "John Doe",
  created_at: "2024-01-01T00:00:00Z",
};

const mockPaginatedResult = {
  data: [mockContract],
  pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

const defaultParams = { page: 1, limit: 20 };

// ── getContractsService ───────────────────────────────────────────────────────

describe("getContractsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with paginated data on success", async () => {
    vi.mocked(repo.listContracts).mockResolvedValue(mockPaginatedResult as any);
    const result = await getContractsService(defaultParams);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data).toHaveLength(1);
      expect(result.data.data[0].title).toBe("Software License Agreement");
    }
  });

  it("returns ok: false with status 500 on repository error", async () => {
    vi.mocked(repo.listContracts).mockRejectedValue(new Error("DB connection failed"));
    const result = await getContractsService(defaultParams);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("DB connection failed");
    }
  });

  it("passes filters to repository", async () => {
    vi.mocked(repo.listContracts).mockResolvedValue(mockPaginatedResult as any);
    await getContractsService(defaultParams, { search: "License", status: "active" });
    expect(repo.listContracts).toHaveBeenCalledWith(
      defaultParams,
      { search: "License", status: "active" }
    );
  });

  it("uses empty filters by default", async () => {
    vi.mocked(repo.listContracts).mockResolvedValue(mockPaginatedResult as any);
    await getContractsService(defaultParams);
    expect(repo.listContracts).toHaveBeenCalledWith(defaultParams, {});
  });
});

// ── getContractByIdService ────────────────────────────────────────────────────

describe("getContractByIdService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with contract when found", async () => {
    vi.mocked(repo.getContractById).mockResolvedValue(mockContract as any);
    const result = await getContractByIdService("contract-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.id).toBe("contract-1");
  });

  it("returns ok: true with null when not found", async () => {
    vi.mocked(repo.getContractById).mockResolvedValue(null);
    const result = await getContractByIdService("nonexistent");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("returns ok: false with status 500 on error", async () => {
    vi.mocked(repo.getContractById).mockRejectedValue(new Error("query failed"));
    const result = await getContractByIdService("contract-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("query failed");
    }
  });
});

// ── createContractService ─────────────────────────────────────────────────────

describe("createContractService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with created contract", async () => {
    vi.mocked(repo.createContract).mockResolvedValue(mockContract as any);
    const payload = { title: "New Contract", expiration_date: "2025-12-31" };
    const result = await createContractService(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.title).toBe("Software License Agreement");
  });

  it("passes payload to repository unchanged", async () => {
    vi.mocked(repo.createContract).mockResolvedValue(mockContract as any);
    const payload = { title: "New Contract", expiration_date: "2025-12-31", contract_size: 10000 };
    await createContractService(payload);
    expect(repo.createContract).toHaveBeenCalledWith(payload);
  });

  it("returns ok: false with status 500 on repository error", async () => {
    vi.mocked(repo.createContract).mockRejectedValue(new Error("duplicate title"));
    const result = await createContractService({ title: "Duplicate" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("duplicate title");
    }
  });

  it("uses fallback error message when error has no message", async () => {
    vi.mocked(repo.createContract).mockRejectedValue({});
    const result = await createContractService({ title: "Test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Failed to create contract");
  });
});

// ── updateContractService ─────────────────────────────────────────────────────

describe("updateContractService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with updated contract", async () => {
    const updated = { ...mockContract, status: "expired" };
    vi.mocked(repo.updateContract).mockResolvedValue(updated as any);
    const result = await updateContractService("contract-1", { status: "expired" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("expired");
  });

  it("calls repository with correct id and payload", async () => {
    vi.mocked(repo.updateContract).mockResolvedValue(mockContract as any);
    await updateContractService("contract-1", { title: "Updated Title" });
    expect(repo.updateContract).toHaveBeenCalledWith("contract-1", { title: "Updated Title" });
  });

  it("returns ok: false on error", async () => {
    vi.mocked(repo.updateContract).mockRejectedValue(new Error("not found"));
    const result = await updateContractService("nonexistent", { title: "X" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});

// ── deleteContractService ─────────────────────────────────────────────────────

describe("deleteContractService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with null data on success", async () => {
    vi.mocked(repo.deleteContract).mockResolvedValue(undefined);
    const result = await deleteContractService("contract-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("calls deleteContract with correct id", async () => {
    vi.mocked(repo.deleteContract).mockResolvedValue(undefined);
    await deleteContractService("contract-1");
    expect(repo.deleteContract).toHaveBeenCalledWith("contract-1");
  });

  it("returns ok: false on error", async () => {
    vi.mocked(repo.deleteContract).mockRejectedValue(new Error("foreign key constraint"));
    const result = await deleteContractService("contract-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("foreign key constraint");
    }
  });
});
