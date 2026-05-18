// ============================================================
// SRM TypeScript Types — mirrors Supabase schema
// ============================================================

export interface Supplier {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  industry: string | null;
  company_size: "micro" | "small" | "medium" | "large" | "enterprise" | null;
  status: "active" | "inactive" | "blacklisted" | "pending";
  logo_url: string | null;
  supplier_code: string | null;
  onboarding_status: "not_invited" | "invited" | "submitted" | "approved" | "rejected" | null;
  invite_status: "not_invited" | "invited" | "registered" | null;
  invited_email: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  latest_performance_score?: number | null;
  last_evaluated_at?: string | null;
  current_risk_level?: RiskLevel | null;
  current_risk_score?: number | null;
  last_risk_assessed_at?: string | null;
  total_value?: number | null;
  parent_name?: string | null;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  department: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceCategory {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  max_score: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PerformanceEvaluation {
  id: string;
  supplier_id: string;
  evaluation_date: string;
  period_start: string | null;
  period_end: string | null;
  overall_score: number | null;
  evaluator_id: string | null;
  evaluator_name: string | null;
  notes: string | null;
  status: "draft" | "submitted" | "approved";
  created_at: string;
  updated_at: string;
}

export interface PerformanceScore {
  id: string;
  evaluation_id: string;
  category_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  // joined
  category?: PerformanceCategory;
}

export interface RiskAssessment {
  id: string;
  supplier_id: string;
  assessment_date: string;
  risk_level: RiskLevel;
  financial_risk: RiskLevel | null;
  operational_risk: RiskLevel | null;
  compliance_risk: RiskLevel | null;
  geopolitical_risk: RiskLevel | null;
  risk_score: number | null;
  mitigation_plan: string | null;
  next_review: string | null;
  assessor_id: string | null;
  assessor_name: string | null;
  notes: string | null;
  status: "active" | "mitigated" | "accepted" | "closed";
  created_at: string;
  updated_at: string;
}

export interface RiskFactor {
  id: string;
  assessment_id: string;
  factor_name: string;
  description: string | null;
  severity: RiskLevel;
  likelihood: "rare" | "unlikely" | "possible" | "likely" | "certain";
  impact_area: string | null;
  mitigation: string | null;
  created_at: string;
}

export interface ContractLink {
  id: string;
  supplier_id: string;
  contract_id: string;
  contract_title: string | null;
  contract_status: string | null;
  link_type: "primary" | "amendment" | "renewal" | "related";
  linked_at: string;
  linked_by: string | null;
}

export interface SupplierDocument {
  id: string;
  supplier_id: string;
  document_name: string;
  document_type:
    | "certificate"
    | "license"
    | "insurance"
    | "financial"
    | "audit"
    | "other"
    | null;
  file_url: string | null;
  file_size: number | null;
  expiry_date: string | null;
  is_verified: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  supplier_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action:
    | "created"
    | "updated"
    | "deleted"
    | "status_changed"
    | "evaluated"
    | "risk_assessed";
  description: string | null;
  metadata: Record<string, unknown>;
  performed_by: string | null;
  performed_at: string;
}

// Summary view type
export interface SupplierSummary {
  id: string;
  name: string;
  status: Supplier["status"];
  industry: string | null;
  city: string | null;
  country: string;
  created_at: string;
  latest_performance_score: number | null;
  last_evaluated_at: string | null;
  current_risk_level: RiskLevel | null;
  current_risk_score: number | null;
  last_risk_assessed_at: string | null;
  contract_count: number;
  contact_count: number;
  /** Present when this supplier is linked to a parent company (subsidiary). */
  parent_id?: string | null;
  parent_name?: string | null;
}

export interface ComparisonSupplierESG {
  overall: number | null;
  env: number | null;
  social: number | null;
  gov: number | null;
}
export interface ComparisonSupplierPerformance {
  overall: number | null;
  quality: number | null;
  delivery: number | null;
  price: number | null;
  communication: number | null;
}
export interface ComparisonSupplierRisk {
  level: string | null;
  financial: number | null;
  operational: number | null;
  compliance: number | null;
  geopolitical: number | null;
  reputational: number | null;
}
export interface ComparisonSupplier {
  id: string;
  name: string;
  industry: string | null;
  status: string | null;
  esg: ComparisonSupplierESG;
  performance: ComparisonSupplierPerformance;
  risk: ComparisonSupplierRisk;
  contract_value: number | null;
}
export interface ComparisonResponse {
  suppliers: ComparisonSupplier[];
}

// Utility types
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DashboardStats {
  total_suppliers: number;
  active_suppliers: number;
  avg_performance_score: number | null;
  high_risk_count: number;
  expiring_documents: number;
  recent_activities: ActivityLog[];
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}
