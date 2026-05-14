import { z } from 'zod';

export const createPerformanceSchema = z.object({
  evaluation_period: z.string().min(1).max(50),
  quality_score: z.number().min(0).max(10),
  delivery_score: z.number().min(0).max(10),
  price_score: z.number().min(0).max(10),
  communication_score: z.number().min(0).max(10),
  quality_weight: z.number().min(0).max(1).optional(),
  delivery_weight: z.number().min(0).max(1).optional(),
  price_weight: z.number().min(0).max(1).optional(),
  communication_weight: z.number().min(0).max(1).optional(),
  notes: z.string().max(1000).optional(),
});

export const updatePerformanceSchema = createPerformanceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
