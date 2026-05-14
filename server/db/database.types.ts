// Auto-generated from production schema — 2025-05-09
// DO NOT edit manually. Reflects 005_canonical_schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OnboardingStatus =
  | 'not_invited'
  | 'invited'
  | 'registered'
  | 'profile_filling'
  | 'submitted'
  | 'approved'
  | 'rejected'

export type AppRole =
  | 'admin'
  | 'procurement_manager'
  | 'esg_analyst'
  | 'viewer'
  | 'supplier'

export type SupplierRow = {
  id: string
  name: string
  tax_id: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  country: string | null
  industry: string | null
  company_size: string | null
  status: string
  logo_url: string | null
  supplier_code: string | null
  onboarding_status: OnboardingStatus
  invite_status: string | null
  invited_email: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  parent_id: string | null
}

// overall_score is a GENERATED ALWAYS column — never set it on insert/update
export type PerformanceEvaluationRow = {
  id: string
  supplier_id: string
  evaluation_period: string
  quality_score: number
  delivery_score: number
  price_score: number
  communication_score: number
  quality_weight: number
  delivery_weight: number
  price_weight: number
  communication_weight: number
  readonly overall_score: number | null // GENERATED — do not insert/update
  notes: string | null
  evaluated_by: string | null
  created_at: string | null
  updated_at: string | null
}

// overall_risk_level is a GENERATED ALWAYS column — never set it on insert/update
export type RiskAssessmentRow = {
  id: string
  supplier_id: string
  assessment_date: string
  financial_risk: number // smallint 1-5
  operational_risk: number // smallint 1-5
  compliance_risk: number // smallint 1-5
  geopolitical_risk: number // smallint 1-5
  reputational_risk: number // smallint 1-5
  readonly overall_risk_level: string | null // GENERATED — do not insert/update
  mitigation_notes: string | null
  notes: string | null
  assessed_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type ActivityLogRow = {
  id: string
  supplier_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  description: string | null
  metadata: Json | null
  performed_by: string | null
  performed_at: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
}

export type SupplierContactRow = {
  id: string
  supplier_id: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  department: string | null
  is_primary: boolean | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SupplierDocumentRow = {
  id: string
  supplier_id: string
  document_name: string
  document_type: string | null
  file_path: string | null
  file_url: string | null
  file_size: number | null
  status: string
  is_verified: boolean | null
  expiry_date: string | null
  approved_by: string | null
  approved_at: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export type SupplierProfileRow = {
  id: string
  supplier_id: string
  legal_name: string | null
  registration_number: string | null
  address: string | null
  country: string | null
  industry: string | null
  employee_count: number | null
  revenue_range: string | null
  website: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export type ContractRow = {
  id: string
  title: string
  supplier_id: string | null
  supplier_name: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  expiration_date: string
  contract_size: number | null
  contract_type: string | null
  category: string | null
  owner: string | null
  created_at: string | null
}

export type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: string | null
  supplier_id: string | null
  created_at: string | null
  updated_at: string | null
}

export type SupplierSummaryRow = {
  id: string | null
  name: string | null
  supplier_code: string | null
  status: string | null
  onboarding_status: OnboardingStatus | null
  invite_status: string | null
  invited_email: string | null
  industry: string | null
  city: string | null
  country: string | null
  latest_performance_score: number | null
  current_risk_level: string | null
  last_evaluated_at: string | null
  last_risk_assessed_at: string | null
  contract_count: number | null
  total_value: number | null
  created_at: string | null
  parent_id: string | null
  parent_name: string | null
}
