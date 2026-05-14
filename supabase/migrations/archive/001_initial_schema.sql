-- ============================================================
-- SRM (Supplier Relationship Manager) - Initial Schema
-- Shared Supabase instance with ContractGuard
-- URL: kzpviefgzrwjbpyqmqae.supabase.co
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. SHARED TABLE: suppliers
--    Both SRM and ContractGuard read/write this table.
--    If ContractGuard already created it, this will be skipped.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    tax_id          TEXT UNIQUE,
    email           TEXT,
    phone           TEXT,
    website         TEXT,
    address         TEXT,
    city            TEXT,
    country         TEXT DEFAULT 'TR',
    industry        TEXT,
    company_size    TEXT CHECK (company_size IN ('micro','small','medium','large','enterprise')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted','pending')),
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.suppliers IS 'Shared supplier directory — used by both SRM and ContractGuard';

-- ============================================================
-- 2. SUPPLIER CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    title           TEXT,
    email           TEXT,
    phone           TEXT,
    is_primary      BOOLEAN DEFAULT false,
    department      TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_contacts IS 'Contact persons for each supplier';

-- ============================================================
-- 3. PERFORMANCE CATEGORIES (lookup table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    weight          NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    max_score       INTEGER NOT NULL DEFAULT 10,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.performance_categories IS 'Scoring dimensions: quality, delivery, price, communication, etc.';

-- Seed default categories
INSERT INTO public.performance_categories (name, description, weight, sort_order) VALUES
    ('quality',       'Product/service quality and defect rate',           2.0, 1),
    ('delivery',      'On-time delivery and lead time reliability',        1.5, 2),
    ('price',         'Cost competitiveness and price stability',          1.5, 3),
    ('communication', 'Responsiveness and communication quality',          1.0, 4),
    ('compliance',    'Regulatory and contractual compliance',             1.5, 5),
    ('innovation',    'Proactive improvement and innovation capability',   1.0, 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. PERFORMANCE EVALUATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_evaluations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start    DATE,
    period_end      DATE,
    overall_score   NUMERIC(5,2),
    evaluator_id    UUID REFERENCES auth.users(id),
    evaluator_name  TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.performance_evaluations IS 'Periodic supplier performance reviews';

-- ============================================================
-- 5. PERFORMANCE SCORES (per category per evaluation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id   UUID NOT NULL REFERENCES public.performance_evaluations(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES public.performance_categories(id),
    score           NUMERIC(5,2) NOT NULL CHECK (score >= 0),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (evaluation_id, category_id)
);

COMMENT ON TABLE public.performance_scores IS 'Individual category scores within an evaluation';

-- ============================================================
-- 6. RISK ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    risk_level      TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
    financial_risk  TEXT CHECK (financial_risk IN ('low','medium','high','critical')),
    operational_risk TEXT CHECK (operational_risk IN ('low','medium','high','critical')),
    compliance_risk TEXT CHECK (compliance_risk IN ('low','medium','high','critical')),
    geopolitical_risk TEXT CHECK (geopolitical_risk IN ('low','medium','high','critical')),
    risk_score      NUMERIC(5,2),
    mitigation_plan TEXT,
    next_review     DATE,
    assessor_id     UUID REFERENCES auth.users(id),
    assessor_name   TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','mitigated','accepted','closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.risk_assessments IS 'Supplier risk evaluations across multiple dimensions';

-- ============================================================
-- 7. RISK FACTORS (detailed risk items)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.risk_factors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id   UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
    factor_name     TEXT NOT NULL,
    description     TEXT,
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    likelihood      TEXT NOT NULL CHECK (likelihood IN ('rare','unlikely','possible','likely','certain')),
    impact_area     TEXT,
    mitigation      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.risk_factors IS 'Granular risk items within an assessment';

-- ============================================================
-- 8. CONTRACT BRIDGE (link to ContractGuard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.srm_contract_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    contract_id     UUID NOT NULL,                -- FK to ContractGuard's contracts table
    contract_title  TEXT,                          -- denormalized for quick display
    contract_status TEXT,                          -- denormalized snapshot
    link_type       TEXT DEFAULT 'primary' CHECK (link_type IN ('primary','amendment','renewal','related')),
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    linked_by       UUID REFERENCES auth.users(id),

    UNIQUE (supplier_id, contract_id)
);

COMMENT ON TABLE public.srm_contract_links IS 'Bridge table linking SRM suppliers to ContractGuard contracts';

-- ============================================================
-- 9. SUPPLIER DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    document_name   TEXT NOT NULL,
    document_type   TEXT CHECK (document_type IN ('certificate','license','insurance','financial','audit','other')),
    file_url        TEXT,
    file_size       INTEGER,
    expiry_date     DATE,
    is_verified     BOOLEAN DEFAULT false,
    uploaded_by     UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_documents IS 'Compliance documents, certificates, and attachments';

-- ============================================================
-- 10. ACTIVITY LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.srm_activity_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    entity_type     TEXT NOT NULL,
    entity_id       UUID,
    action          TEXT NOT NULL CHECK (action IN ('created','updated','deleted','status_changed','evaluated','risk_assessed')),
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    performed_by    UUID REFERENCES auth.users(id),
    performed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.srm_activity_log IS 'Audit trail for all SRM actions';

-- ============================================================
-- 11. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON public.suppliers(country);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON public.supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_perf_eval_supplier ON public.performance_evaluations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_perf_eval_date ON public.performance_evaluations(evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_scores_eval ON public.performance_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_risk_assess_supplier ON public.risk_assessments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_risk_assess_level ON public.risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_factors_assess ON public.risk_factors(assessment_id);
CREATE INDEX IF NOT EXISTS idx_contract_links_supplier ON public.srm_contract_links(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contract_links_contract ON public.srm_contract_links(contract_id);
CREATE INDEX IF NOT EXISTS idx_supplier_docs_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_docs_expiry ON public.supplier_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_activity_log_supplier ON public.srm_activity_log(supplier_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_performed ON public.srm_activity_log(performed_at DESC);

-- ============================================================
-- 12. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'suppliers',
        'supplier_contacts',
        'performance_evaluations',
        'risk_assessments',
        'supplier_documents'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I; 
             CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I 
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================
-- 13. WEIGHTED SCORE CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_weighted_score(p_evaluation_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    result NUMERIC;
BEGIN
    SELECT
        CASE 
            WHEN SUM(pc.weight * pc.max_score) = 0 THEN 0
            ELSE ROUND(
                (SUM(ps.score * pc.weight) / SUM(pc.weight * pc.max_score)) * 100,
                2
            )
        END INTO result
    FROM public.performance_scores ps
    JOIN public.performance_categories pc ON pc.id = ps.category_id
    WHERE ps.evaluation_id = p_evaluation_id
      AND pc.is_active = true;

    -- Update the evaluation record
    UPDATE public.performance_evaluations
    SET overall_score = result
    WHERE id = p_evaluation_id;

    RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 14. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srm_contract_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srm_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_categories ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all, insert, and update
-- (Adjust these policies based on your role model)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'suppliers',
        'supplier_contacts',
        'performance_evaluations',
        'performance_scores',
        'risk_assessments',
        'risk_factors',
        'srm_contract_links',
        'supplier_documents',
        'srm_activity_log',
        'performance_categories'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %s" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Authenticated read %s" ON public.%I 
             FOR SELECT TO authenticated USING (true);',
            tbl, tbl
        );
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated insert %s" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Authenticated insert %s" ON public.%I 
             FOR INSERT TO authenticated WITH CHECK (true);',
            tbl, tbl
        );
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated update %s" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Authenticated update %s" ON public.%I 
             FOR UPDATE TO authenticated USING (true) WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================
-- 15. VIEWS (handy aggregations)
-- ============================================================

-- Supplier summary with latest performance & risk
CREATE OR REPLACE VIEW public.v_supplier_summary AS
SELECT
    s.id,
    s.name,
    s.status,
    s.industry,
    s.city,
    s.country,
    s.created_at,
    -- Latest performance score
    latest_eval.overall_score       AS latest_performance_score,
    latest_eval.evaluation_date     AS last_evaluated_at,
    -- Latest risk level
    latest_risk.risk_level          AS current_risk_level,
    latest_risk.risk_score          AS current_risk_score,
    latest_risk.assessment_date     AS last_risk_assessed_at,
    -- Counts
    (SELECT COUNT(*) FROM public.srm_contract_links cl WHERE cl.supplier_id = s.id) AS contract_count,
    (SELECT COUNT(*) FROM public.supplier_contacts sc WHERE sc.supplier_id = s.id)  AS contact_count
FROM public.suppliers s
LEFT JOIN LATERAL (
    SELECT pe.overall_score, pe.evaluation_date
    FROM public.performance_evaluations pe
    WHERE pe.supplier_id = s.id AND pe.status = 'approved'
    ORDER BY pe.evaluation_date DESC
    LIMIT 1
) latest_eval ON true
LEFT JOIN LATERAL (
    SELECT ra.risk_level, ra.risk_score, ra.assessment_date
    FROM public.risk_assessments ra
    WHERE ra.supplier_id = s.id AND ra.status = 'active'
    ORDER BY ra.assessment_date DESC
    LIMIT 1
) latest_risk ON true;

COMMENT ON VIEW public.v_supplier_summary IS 'Aggregated supplier view with latest performance and risk data';
