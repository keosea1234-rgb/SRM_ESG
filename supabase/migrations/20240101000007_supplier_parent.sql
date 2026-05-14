-- Parent company (subsidiary) link on suppliers + summary view

ALTER TABLE public.srm_suppliers
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.srm_suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_parent_id ON public.srm_suppliers(parent_id);

CREATE OR REPLACE VIEW public.v_supplier_summary AS
 SELECT s.id,
    s.name,
    s.country,
    s.industry,
    s.status,
    s.supplier_code,
    s.onboarding_status,
    s.invite_status,
    s.invited_email,
    s.created_at,
    COALESCE(c.contract_count, (0)::bigint) AS contract_count,
    COALESCE(c.total_value, (0)::numeric) AS total_value,
    s.city,
    pe.latest_performance_score,
    pe.last_evaluated_at,
    ra.current_risk_level,
    ra.last_risk_assessed_at,
    s.parent_id,
    par.name AS parent_name
   FROM ((((public.srm_suppliers s
     LEFT JOIN public.srm_suppliers par ON ((par.id = s.parent_id)))
     LEFT JOIN ( SELECT contracts.supplier_id,
            count(*) AS contract_count,
            sum(contracts.contract_size) AS total_value
           FROM public.contracts
          GROUP BY contracts.supplier_id) c ON ((c.supplier_id = s.id)))
     LEFT JOIN ( SELECT DISTINCT ON (srm_performance_evaluations.supplier_id) srm_performance_evaluations.supplier_id,
            srm_performance_evaluations.overall_score AS latest_performance_score,
            srm_performance_evaluations.created_at AS last_evaluated_at
           FROM public.srm_performance_evaluations
          ORDER BY srm_performance_evaluations.supplier_id, srm_performance_evaluations.evaluation_period DESC) pe ON ((pe.supplier_id = s.id)))
     LEFT JOIN ( SELECT DISTINCT ON (srm_risk_assessments.supplier_id) srm_risk_assessments.supplier_id,
            srm_risk_assessments.overall_risk_level AS current_risk_level,
            srm_risk_assessments.assessment_date AS last_risk_assessed_at
           FROM public.srm_risk_assessments
          ORDER BY srm_risk_assessments.supplier_id, srm_risk_assessments.assessment_date DESC) ra ON ((ra.supplier_id = s.id)));
