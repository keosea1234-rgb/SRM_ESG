import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(200),
  status: z.enum(['active', 'inactive', 'pending', 'suspended']),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  website: z.string().max(500).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  company_size: z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
  tax_id: z.string().max(50).optional(),
  logo_url: z.string().max(500).optional().or(z.literal('')),
  parent_id: z.string().uuid().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(300).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  role: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
});

export const upsertProfileSchema = z
  .object({
    company_name: z.string().trim().max(200).optional(),
    website: z.union([z.string().trim().url(), z.literal('')]).optional(),
    description: z.string().trim().max(2000).optional(),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    primary_contact_name: z.string().trim().max(200).optional(),
    primary_contact_email: z
      .union([z.string().trim().email(), z.literal('')])
      .optional(),
    primary_contact_phone: z.string().trim().max(50).optional(),
    certifications: z
      .array(z.string().trim().max(100))
      .max(20)
      .optional(),
    payment_terms: z.string().trim().max(200).optional(),
    bank_details: z.string().trim().max(500).optional(),
  })
  .strict();

export type UpsertProfileBody = z.infer<typeof upsertProfileSchema>;

export const inviteSupplierSchema = z.object({
  email: z.string().email("Invalid email address").min(1).max(300),
});

export const uploadDocumentMetaSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  document_name: z.string().min(1).max(300).optional(),
});
// Holds validation schemas for supplier payloads.