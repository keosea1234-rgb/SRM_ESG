import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./suppliers.repository", () => ({
  getAllSuppliers: vi.fn(),
  getSupplierById: vi.fn(),
  getSupplierContacts: vi.fn(),
  createSupplierContact: vi.fn(),
  getSupplierContracts: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  getSupplierForInvite: vi.fn(),
  inviteSupplierByEmail: vi.fn(),
  markSupplierInvited: vi.fn(),
  insertSupplierActivityLog: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  inviteSupplier,
  getSupplierContacts,
  getSupplierContracts,
} from "./suppliers.service";
import * as repo from "./suppliers.repository";

const mockSupplier = {
  id: "sup-1",
  name: "Acme Corp",
  tax_id: "TR123456",
  email: "acme@example.com",
  phone: null,
  website: null,
  address: null,
  city: "Istanbul",
  country: "TR",
  industry: "Technology",
  company_size: "medium" as const,
  status: "active" as const,
  logo_url: null,
  supplier_code: "ACM001",
  onboarding_status: "not_invited" as const,
  invite_status: "not_invited" as const,
  invited_email: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  created_by: null,
};

describe("getAllSuppliers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok: true with data on success", async () => {
    vi.mocked(repo.getAllSuppliers).mockResolvedValue({ data: [mockSupplier as any], error: null });
    const result = await getAllSuppliers();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("returns ok: false with status 500 on repository error", async () => {
    vi.mocked(repo.getAllSuppliers).mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "500", details: "", hint: "" },
    });
    const result = await getAllSuppliers();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("DB error");
    }
  });

  it("returns empty array when data is null", async () => {
    vi.mocked(repo.getAllSuppliers).mockResolvedValue({ data: null, error: null });
    const result = await getAllSuppliers();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

describe("getSupplierById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns found supplier", async () => {
    vi.mocked(repo.getSupplierById).mockResolvedValue({ data: mockSupplier, error: null });
    const result = await getSupplierById("sup-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("sup-1");
  });

  it("returns ok: false with 404 when not found", async () => {
    vi.mocked(repo.getSupplierById).mockResolvedValue({ data: null, error: null });
    const result = await getSupplierById("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("createSupplier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns created supplier", async () => {
    vi.mocked(repo.createSupplier).mockResolvedValue({ data: mockSupplier, error: null });
    const result = await createSupplier({ name: "Acme Corp", country: "TR" }, "user-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Acme Corp");
  });

  it("adds created_by to payload", async () => {
    vi.mocked(repo.createSupplier).mockResolvedValue({ data: mockSupplier, error: null });
    await createSupplier({ name: "Acme Corp" }, "user-42");
    expect(repo.createSupplier).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: "user-42" })
    );
  });

  it("writes activity log", async () => {
    vi.mocked(repo.createSupplier).mockResolvedValue({ data: mockSupplier, error: null });
    await createSupplier({ name: "Acme Corp" }, "user-1");
    expect(repo.insertSupplierActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", supplier_id: "sup-1" })
    );
  });

  it("returns ok: false with 400 on repository error", async () => {
    vi.mocked(repo.createSupplier).mockResolvedValue({
      data: null,
      error: { message: "duplicate key", code: "23505", details: "", hint: "" },
    });
    const result = await createSupplier({ name: "Duplicate" }, "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("duplicate key");
    }
  });
});

describe("updateSupplier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("strips field_name, old_value, new_value from DB payload", async () => {
    vi.mocked(repo.updateSupplier).mockResolvedValue({ data: mockSupplier, error: null });
    await updateSupplier(
      "sup-1",
      { name: "New Name", field_name: "name", old_value: "Old", new_value: "New" },
      "user-1"
    );
    const dbPayload = vi.mocked(repo.updateSupplier).mock.calls[0][1];
    expect(dbPayload).not.toHaveProperty("field_name");
    expect(dbPayload).not.toHaveProperty("old_value");
    expect(dbPayload).not.toHaveProperty("new_value");
    expect(dbPayload).toHaveProperty("name", "New Name");
  });

  it("writes field-level activity log", async () => {
    vi.mocked(repo.updateSupplier).mockResolvedValue({ data: mockSupplier, error: null });
    await updateSupplier(
      "sup-1",
      { status: "inactive", field_name: "status", old_value: "active", new_value: "inactive" },
      "user-1"
    );
    expect(repo.insertSupplierActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated" })
    );
  });
});

describe("inviteSupplier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("successful invite returns ok: true with email", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({
      data: { id: "sup-1", name: "Acme", invite_status: "not_invited" },
      error: null,
    });
    vi.mocked(repo.inviteSupplierByEmail).mockResolvedValue({ error: null });
    vi.mocked(repo.markSupplierInvited).mockResolvedValue({ data: mockSupplier, error: null });

    const result = await inviteSupplier({ supplierId: "sup-1", email: "contact@acme.com", userId: "user-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.email).toBe("contact@acme.com");
    }
  });

  it("returns ok: false with 400 when supplier already registered", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({
      data: { id: "sup-1", name: "Acme", invite_status: "registered" },
      error: null,
    });
    const result = await inviteSupplier({ supplierId: "sup-1", email: "a@b.com", userId: "user-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("Supplier already registered");
    }
  });

  it("returns ok: false with 404 when supplier not found", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({ data: null, error: null });
    const result = await inviteSupplier({ supplierId: "nonexistent", email: "a@b.com", userId: "user-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("returns ok: false with 500 when email send fails", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({
      data: { id: "sup-1", name: "Acme", invite_status: "not_invited" },
      error: null,
    });
    vi.mocked(repo.inviteSupplierByEmail).mockResolvedValue({ error: { message: "SMTP failure" } });
    const result = await inviteSupplier({ supplierId: "sup-1", email: "a@b.com", userId: "user-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("SMTP failure");
    }
  });

  it("calls markSupplierInvited after successful invite", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({
      data: { id: "sup-1", name: "Acme", invite_status: "not_invited" },
      error: null,
    });
    vi.mocked(repo.inviteSupplierByEmail).mockResolvedValue({ error: null });
    vi.mocked(repo.markSupplierInvited).mockResolvedValue({ data: mockSupplier, error: null });
    await inviteSupplier({ supplierId: "sup-1", email: "contact@acme.com", userId: "user-1" });
    expect(repo.markSupplierInvited).toHaveBeenCalledWith("sup-1", "contact@acme.com");
  });

  it("writes invite activity log", async () => {
    vi.mocked(repo.getSupplierForInvite).mockResolvedValue({
      data: { id: "sup-1", name: "Acme", invite_status: "not_invited" },
      error: null,
    });
    vi.mocked(repo.inviteSupplierByEmail).mockResolvedValue({ error: null });
    vi.mocked(repo.markSupplierInvited).mockResolvedValue({ data: mockSupplier, error: null });
    await inviteSupplier({ supplierId: "sup-1", email: "contact@acme.com", userId: "user-1" });
    expect(repo.insertSupplierActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invited", supplier_id: "sup-1" })
    );
  });
});

describe("getSupplierContacts", () => {
  it("returns empty array", async () => {
    vi.mocked(repo.getSupplierContacts).mockResolvedValue({ data: [], error: null });
    const result = await getSupplierContacts("sup-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

describe("getSupplierContracts", () => {
  it("returns ok: false with 500 on repository error", async () => {
    vi.mocked(repo.getSupplierContracts).mockResolvedValue({
      data: null,
      error: { message: "query failed", code: "500", details: "", hint: "" },
    });
    const result = await getSupplierContracts("sup-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});
