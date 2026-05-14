-- Compliance module: reporting, materiality, carbon, risk indicators, product compliance, monitoring

-- Reporting
CREATE TABLE srm_compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE srm_compliance_reporting_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES srm_compliance_frameworks(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  title text NOT NULL,
  pillar text NOT NULL DEFAULT 'governance',
  response_status text NOT NULL DEFAULT 'pending',
  is_mapped boolean NOT NULL DEFAULT true,
  UNIQUE (framework_id, requirement_code)
);

CREATE INDEX idx_compliance_req_framework ON srm_compliance_reporting_requirements(framework_id);

CREATE TABLE srm_compliance_reporting_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES srm_compliance_reporting_requirements(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compliance_evidence_req ON srm_compliance_reporting_evidence(requirement_id);

-- Materiality
CREATE TABLE srm_compliance_materiality_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  reporting_period text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  threshold numeric NOT NULL DEFAULT 2.5,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE srm_compliance_materiality_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES srm_compliance_materiality_assessments(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  impact_score numeric NOT NULL DEFAULT 0,
  financial_score numeric NOT NULL DEFAULT 0,
  is_material boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_compliance_mat_topics_assessment ON srm_compliance_materiality_topics(assessment_id);

-- Carbon
CREATE TABLE srm_compliance_carbon_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  category text,
  tco2e numeric NOT NULL DEFAULT 0,
  data_quality text NOT NULL DEFAULT 'estimated',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT compliance_carbon_scope_chk CHECK (scope IN ('scope1', 'scope2', 'scope3'))
);

CREATE TABLE srm_compliance_carbon_sbti_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE srm_compliance_carbon_product_footprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Risk indicators
CREATE TABLE srm_compliance_risk_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  source_type text NOT NULL DEFAULT 'internal',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE srm_compliance_risk_score_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid REFERENCES srm_compliance_risk_indicators(id) ON DELETE CASCADE,
  kind text NOT NULL,
  score numeric,
  CONSTRAINT compliance_risk_score_kind_chk CHECK (kind IN ('supplier', 'tier', 'country', 'sector'))
);

CREATE INDEX idx_compliance_risk_scores_indicator ON srm_compliance_risk_score_rows(indicator_id);
CREATE INDEX idx_compliance_risk_scores_kind ON srm_compliance_risk_score_rows(kind);

-- Product compliance
CREATE TABLE srm_compliance_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Product',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE srm_compliance_product_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_code text NOT NULL,
  requirement_code text NOT NULL,
  title text NOT NULL,
  criticality text NOT NULL DEFAULT 'standard'
);

CREATE TABLE srm_compliance_product_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES srm_compliance_products(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES srm_compliance_product_requirements(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  UNIQUE (product_id, requirement_id)
);

CREATE INDEX idx_compliance_prod_assess_product ON srm_compliance_product_assessments(product_id);

-- Monitoring
CREATE TABLE srm_compliance_monitoring_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'feed',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE srm_compliance_monitoring_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES srm_compliance_monitoring_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  severity text,
  review_status text NOT NULL DEFAULT 'new',
  source_url text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compliance_hits_source ON srm_compliance_monitoring_hits(source_id);

CREATE TABLE srm_compliance_monitoring_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE srm_compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_reporting_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_reporting_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_materiality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_materiality_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_carbon_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_carbon_sbti_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_carbon_product_footprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_risk_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_risk_score_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_product_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_product_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_monitoring_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_monitoring_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_monitoring_incidents ENABLE ROW LEVEL SECURITY;

-- Seed
INSERT INTO srm_compliance_frameworks (code, name, status) VALUES
  ('CSRD', 'CSRD', 'active'),
  ('GRI', 'GRI Standards', 'active');

INSERT INTO srm_compliance_reporting_requirements (framework_id, requirement_code, title, pillar, response_status, is_mapped)
SELECT f.id, 'CSRD-E1', 'Climate-related metrics', 'environmental', 'complete', true
FROM srm_compliance_frameworks f WHERE f.code = 'CSRD';

INSERT INTO srm_compliance_reporting_requirements (framework_id, requirement_code, title, pillar, response_status, is_mapped)
SELECT f.id, 'CSRD-S1', 'Workforce disclosures', 'social', 'in_progress', true
FROM srm_compliance_frameworks f WHERE f.code = 'CSRD';

INSERT INTO srm_compliance_reporting_requirements (framework_id, requirement_code, title, pillar, response_status, is_mapped)
SELECT f.id, 'GRI-2-9', 'Governance structure', 'governance', 'pending', false
FROM srm_compliance_frameworks f WHERE f.code = 'GRI';

INSERT INTO srm_compliance_reporting_evidence (requirement_id)
SELECT id FROM srm_compliance_reporting_requirements WHERE requirement_code = 'CSRD-E1' LIMIT 1;

INSERT INTO srm_compliance_materiality_assessments (title, reporting_period, status, threshold)
VALUES ('FY2025 double materiality', '2025', 'approved', 3.0);

INSERT INTO srm_compliance_materiality_topics (assessment_id, title, category, impact_score, financial_score, is_material)
SELECT a.id, 'Scope 3 emissions', 'Environmental', 4.2, 3.1, true
FROM srm_compliance_materiality_assessments a WHERE a.reporting_period = '2025' LIMIT 1;

INSERT INTO srm_compliance_materiality_topics (assessment_id, title, category, impact_score, financial_score, is_material)
SELECT a.id, 'Packaging waste', 'Environmental', 2.0, 2.4, false
FROM srm_compliance_materiality_assessments a WHERE a.reporting_period = '2025' LIMIT 1;

INSERT INTO srm_compliance_carbon_records (scope, category, tco2e, data_quality) VALUES
  ('scope1', 'stationary_combustion', 1200.5, 'measured'),
  ('scope2', 'purchased_electricity', 3400.0, 'measured'),
  ('scope3', 'purchased_goods', 8900.25, 'estimated'),
  ('scope3', 'upstream_transport', 2100.0, 'estimated');

INSERT INTO srm_compliance_carbon_sbti_targets (payload) VALUES
  ('{"target_type":"near_term","year":2030,"reduction_pct":42}'::jsonb);

INSERT INTO srm_compliance_carbon_product_footprints (payload) VALUES
  ('{"sku":"SKU-1001","tco2e":12.3}'::jsonb);

INSERT INTO srm_compliance_risk_indicators (code, name, category, weight, source_type, is_active) VALUES
  ('R-GEO', 'Geopolitical exposure', 'geopolitical', 1.2, 'external', true),
  ('R-REG', 'Regulatory change velocity', 'compliance', 1.0, 'internal', true),
  ('R-REP', 'Reputational sentiment', 'reputational', 0.8, 'external', false);

INSERT INTO srm_compliance_risk_score_rows (indicator_id, kind, score)
SELECT i.id, 'supplier', 72 FROM srm_compliance_risk_indicators i WHERE i.code = 'R-GEO';

INSERT INTO srm_compliance_risk_score_rows (indicator_id, kind, score)
SELECT i.id, 'tier', 3 FROM srm_compliance_risk_indicators i WHERE i.code = 'R-REG';

INSERT INTO srm_compliance_risk_score_rows (indicator_id, kind, score)
SELECT i.id, 'country', 65 FROM srm_compliance_risk_indicators i WHERE i.code = 'R-REP';

INSERT INTO srm_compliance_risk_score_rows (indicator_id, kind, score)
SELECT i.id, 'sector', 58 FROM srm_compliance_risk_indicators i WHERE i.code = 'R-REG';

INSERT INTO srm_compliance_products (label) VALUES ('Resin grade A'), ('Film SKU-12');

INSERT INTO srm_compliance_product_requirements (regulation_code, requirement_code, title, criticality) VALUES
  ('EU-PPWR', 'PPWR-trace', 'Recycled content traceability', 'critical'),
  ('FDA', 'FDA-21-101', 'Food contact documentation', 'standard');

INSERT INTO srm_compliance_product_assessments (product_id, requirement_id, status)
SELECT p.id, r.id, 'complete'
FROM srm_compliance_products p
CROSS JOIN srm_compliance_product_requirements r
WHERE p.label = 'Resin grade A' AND r.requirement_code = 'PPWR-trace';

INSERT INTO srm_compliance_product_assessments (product_id, requirement_id, status)
SELECT p.id, r.id, 'pending'
FROM srm_compliance_products p
CROSS JOIN srm_compliance_product_requirements r
WHERE p.label = 'Film SKU-12' AND r.requirement_code = 'FDA-21-101';

INSERT INTO srm_compliance_monitoring_sources (code, name, source_type, is_active) VALUES
  ('NEWS-AMCOR', 'Amcor news scan', 'news', true);

INSERT INTO srm_compliance_monitoring_hits (source_id, title, severity, review_status, source_url, confidence)
SELECT s.id, 'Supplier cited in packaging waste review', 'medium', 'new', 'https://example.com/article/1', 0.82
FROM srm_compliance_monitoring_sources s WHERE s.code = 'NEWS-AMCOR' LIMIT 1;

INSERT INTO srm_compliance_monitoring_incidents (payload) VALUES
  ('{"type":"alert","summary":"Escalated media mention"}'::jsonb);
