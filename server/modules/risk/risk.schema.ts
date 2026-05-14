import { z } from 'zod';

export const createRiskSchema = z.object({
  financial_risk: z.number().int().min(1).max(5),
  operational_risk: z.number().int().min(1).max(5),
  compliance_risk: z.number().int().min(1).max(5),
  geopolitical_risk: z.number().int().min(1).max(5),
  reputational_risk: z.number().int().min(1).max(5),
  assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateRiskSchema = createRiskSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
