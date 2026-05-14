import { describe, it, expect } from 'vitest';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.schema';

describe('createSupplierSchema', () => {
  it('passes with minimum required fields', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all optional fields', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
      email: 'contact@acme.com',
      phone: '+1234567890',
      city: 'Istanbul',
      country: 'Turkey',
      company_size: 'large',
    });
    expect(result.success).toBe(true);
  });

  it('fails when name is missing', () => {
    const result = createSupplierSchema.safeParse({ status: 'active' });
    expect(result.success).toBe(false);
  });

  it('fails when name is too short', () => {
    const result = createSupplierSchema.safeParse({ name: 'A', status: 'active' });
    expect(result.success).toBe(false);
  });

  it('fails when status is missing', () => {
    const result = createSupplierSchema.safeParse({ name: 'Acme Corp' });
    expect(result.success).toBe(false);
  });

  it('fails when status is invalid enum value', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'unknown_status',
    });
    expect(result.success).toBe(false);
  });

  it('fails when email format is invalid', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('fails when company_size is invalid enum value', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
      company_size: 'tiny',
    });
    expect(result.success).toBe(false);
  });

  it('passes with optional parent_id uuid', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
      parent_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('fails when parent_id is not a uuid', () => {
    const result = createSupplierSchema.safeParse({
      name: 'Acme Corp',
      status: 'active',
      parent_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSupplierSchema', () => {
  it('passes with a single valid field', () => {
    const result = updateSupplierSchema.safeParse({ city: 'Ankara' });
    expect(result.success).toBe(true);
  });

  it('fails when body is completely empty', () => {
    const result = updateSupplierSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when provided field is invalid', () => {
    const result = updateSupplierSchema.safeParse({ email: 'bad-email' });
    expect(result.success).toBe(false);
  });
});
