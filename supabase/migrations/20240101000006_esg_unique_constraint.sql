-- Ensure only one approved assessment per supplier per period
CREATE UNIQUE INDEX IF NOT EXISTS uq_esg_supplier_period_approved
  ON public.srm_esg_assessments (supplier_id, period)
  WHERE status = 'approved';
