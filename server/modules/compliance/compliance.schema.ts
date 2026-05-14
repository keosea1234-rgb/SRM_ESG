import { z } from "zod";

const scopeEnum = z.enum(["scope1", "scope2", "scope3"]);

export const MaterialityTopicInputSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  impact_score: z.coerce.number().optional(),
  financial_score: z.coerce.number().optional(),
  is_material: z.boolean().optional(),
});

export const MaterialityAssessmentCreateSchema = z.object({
  title: z.string().min(1),
  reporting_period: z.string().min(1),
  status: z.string().optional(),
  threshold: z.coerce.number().optional(),
  topics: z.array(MaterialityTopicInputSchema).optional(),
});

export const CarbonRecordCreateSchema = z.object({
  scope: scopeEnum,
  category: z.string().optional().nullable(),
  tco2e: z.coerce.number(),
  data_quality: z.string().optional(),
});

export const ProductComplianceAssessmentCreateSchema = z.object({
  product_id: z.string().uuid(),
  requirement_id: z.string().uuid(),
  status: z.string().optional(),
});

export const MonitoringHitCreateSchema = z.object({
  source_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  severity: z.string().optional().nullable(),
  review_status: z.string().optional(),
  source_url: z.string().optional(),
  confidence: z.coerce.number().optional(),
});

export type MaterialityAssessmentCreate = z.infer<typeof MaterialityAssessmentCreateSchema>;
export type CarbonRecordCreate = z.infer<typeof CarbonRecordCreateSchema>;
export type ProductComplianceAssessmentCreate = z.infer<typeof ProductComplianceAssessmentCreateSchema>;
export type MonitoringHitCreate = z.infer<typeof MonitoringHitCreateSchema>;
