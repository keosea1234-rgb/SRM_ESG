// server/shared/pagination.test.ts
// Unit tests for shared pagination utility
// These are pure functions — no DB, no mocks needed

import { describe, it, expect } from "vitest";
import {
  parsePagination,
  toRange,
  buildPaginationMeta,
  buildPaginatedResult,
} from "./pagination";

describe("parsePagination", () => {
  it("returns defaults when query is empty", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20 });
  });

  it("parses valid page and limit", () => {
    expect(parsePagination({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it("falls back to default page if page < 1", () => {
    expect(parsePagination({ page: "0" })).toEqual({ page: 1, limit: 20 });
  });

  it("falls back to default page if page is NaN", () => {
    expect(parsePagination({ page: "abc" })).toEqual({ page: 1, limit: 20 });
  });

  it("caps limit at MAX_LIMIT (100)", () => {
    expect(parsePagination({ limit: "999" })).toEqual({ page: 1, limit: 20 });
  });

  it("falls back to default limit if limit < 1", () => {
    expect(parsePagination({ limit: "0" })).toEqual({ page: 1, limit: 20 });
  });

  it("falls back to default limit if limit is NaN", () => {
    expect(parsePagination({ limit: "xyz" })).toEqual({ page: 1, limit: 20 });
  });
});

describe("toRange", () => {
  it("returns correct range for page 1", () => {
    expect(toRange({ page: 1, limit: 20 })).toEqual({ from: 0, to: 19 });
  });

  it("returns correct range for page 2", () => {
    expect(toRange({ page: 2, limit: 20 })).toEqual({ from: 20, to: 39 });
  });

  it("returns correct range for page 3 with limit 10", () => {
    expect(toRange({ page: 3, limit: 10 })).toEqual({ from: 20, to: 29 });
  });
});

describe("buildPaginationMeta", () => {
  it("calculates totalPages correctly", () => {
    const meta = buildPaginationMeta(100, { page: 1, limit: 20 });
    expect(meta).toEqual({ total: 100, page: 1, limit: 20, totalPages: 5 });
  });

  it("rounds up totalPages for uneven division", () => {
    const meta = buildPaginationMeta(101, { page: 1, limit: 20 });
    expect(meta.totalPages).toBe(6);
  });

  it("returns totalPages 0 when total is 0", () => {
    const meta = buildPaginationMeta(0, { page: 1, limit: 20 });
    expect(meta.totalPages).toBe(0);
  });
});

describe("buildPaginatedResult", () => {
  it("wraps data and pagination correctly", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = buildPaginatedResult(data, 50, { page: 2, limit: 10 });

    expect(result.data).toEqual(data);
    expect(result.pagination).toEqual({
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 5,
    });
  });
});
