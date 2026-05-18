import { z } from "zod";

const uuidListParam = z.preprocess((value) => {
  if (typeof value === "string") return value.split(",").filter(Boolean);
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(",")).filter(Boolean);
  return undefined;
}, z.array(z.string().uuid()).optional());

export const spendSummaryFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  categoryIds: uuidListParam,
  regionId: z.string().uuid().optional(),
  regionIds: uuidListParam,
  supplierId: z.string().uuid().optional(),
  supplierIds: uuidListParam,
  businessGroupId: z.string().uuid().optional(),
  businessGroupIds: uuidListParam,
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type SpendSummaryFilters = z.infer<typeof spendSummaryFiltersSchema>;

export function parseSpendSummaryFilters(query: Record<string, unknown>): SpendSummaryFilters {
  const parsed = spendSummaryFiltersSchema.safeParse(query);
  return parsed.success ? parsed.data : {};
}
