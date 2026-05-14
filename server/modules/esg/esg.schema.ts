import { z } from "zod";

export const EsgAssessmentCreateSchema = z.object({
  assessment_date: z.string().optional(),
  period: z.string().min(1),

  // Environmental
  carbon_footprint_tons: z.number().min(0).optional().nullable(),
  // 0-100 percentage
  renewable_energy_pct: z.number().min(0).max(100).optional().nullable(),
  // 0-100 percentage
  waste_recycling_pct: z.number().min(0).max(100).optional().nullable(),
  water_usage_m3: z.number().min(0).optional().nullable(),
  env_certifications: z.array(z.string()).optional().default([]),

  // Social
  employee_count: z.number().int().min(0).optional().nullable(),
  // 0-100 percentage
  women_in_mgmt_pct: z.number().min(0).max(100).optional().nullable(),
  // rate per 200,000 hours worked, non-negative
  lost_time_injury_rate: z.number().min(0).optional().nullable(),
  living_wage_compliant: z.boolean().optional().nullable(),
  child_labor_policy: z.boolean().optional().nullable(),
  social_certifications: z.array(z.string()).optional().default([]),

  // Governance
  anti_corruption_policy: z.boolean().optional().nullable(),
  independent_audit: z.boolean().optional().nullable(),
  gdpr_compliant: z.boolean().optional().nullable(),
  // incident count, integer and non-negative
  data_breach_incidents: z.number().int().min(0).optional().nullable(),
  gov_certifications: z.array(z.string()).optional().default([]),

  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "submitted", "approved"]).default("draft"),
});

export type EsgAssessmentCreate = z.infer<typeof EsgAssessmentCreateSchema>;

/** Latest assessment fields used for single-row ESG narrative (pillar scores + drivers). */
export interface EsgAssessmentRow {
  overall_esg_score?: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
  renewable_energy_pct?: number | null;
  waste_recycling_pct?: number | null;
  carbon_footprint_tons?: number | null;
  water_usage_m3?: number | null;
  women_in_mgmt_pct?: number | null;
  lost_time_injury_rate?: number | null;
  living_wage_compliant?: boolean | null;
  child_labor_policy?: boolean | null;
  anti_corruption_policy?: boolean | null;
  independent_audit?: boolean | null;
  gdpr_compliant?: boolean | null;
  data_breach_incidents?: number | null;
  status?: string | null;
}

export const EsgScoringWeightsSchema = z.object({
  env: z.number(),
  social: z.number(),
  gov: z.number(),
});

export const EsgAssessmentResponseSchema = EsgAssessmentCreateSchema.extend({
  id: z.string(),
  supplier_id: z.string(),
  assessed_by: z.string().nullable().optional(),
  overall_esg_score: z.number().nullable(),
  env_score: z.number().nullable(),
  social_score: z.number().nullable(),
  gov_score: z.number().nullable(),
  scoring_version: z.string(),
  scoring_weights: EsgScoringWeightsSchema,
  /** Present on GET /api/esg/:supplierId (supplier detail). */
  narrative: z.string().optional(),
});

export type EsgAssessmentResponse = z.infer<typeof EsgAssessmentResponseSchema>;
