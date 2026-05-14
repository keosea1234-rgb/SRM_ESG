import { z } from 'zod';

export const createContractSchema = z.object({
  title: z.string().min(2).max(300),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  status: z.enum(['draft', 'active', 'expired', 'terminated']).optional(),
  contract_type: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  owner: z.string().max(200).optional(),
  contract_size: z.number().positive().optional(),
  business_group: z.string().max(200).optional(),
  supplier_name: z.string().max(200).optional(),
  supplier_contact: z.string().max(200).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateContractSchema = createContractSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
