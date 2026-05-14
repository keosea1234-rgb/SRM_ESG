CREATE TABLE srm_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES srm_suppliers(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT alert_type_check CHECK (alert_type IN (
    'esg_threshold_crossed',
    'cert_expiring',
    'risk_spike',
    'performance_drop',
    'missing_compliance_doc',
    'supplier_inactivity'
  ))
);

CREATE INDEX idx_alerts_supplier ON srm_alerts(supplier_id);
CREATE INDEX idx_alerts_unread ON srm_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_created ON srm_alerts(created_at DESC);

ALTER TABLE srm_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read alerts"
  ON srm_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access alerts"
  ON srm_alerts USING (auth.role() = 'service_role');
