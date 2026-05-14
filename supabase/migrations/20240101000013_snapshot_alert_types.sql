-- Extend srm_alerts.alert_type for daily snapshot worker rules (post-snapshot alerts).
ALTER TABLE srm_alerts DROP CONSTRAINT IF EXISTS alert_type_check;

ALTER TABLE srm_alerts ADD CONSTRAINT alert_type_check CHECK (alert_type IN (
  'esg_threshold_crossed',
  'cert_expiring',
  'risk_spike',
  'performance_drop',
  'missing_compliance_doc',
  'supplier_inactivity',
  'esg_score_decline',
  'high_risk_assessment',
  'contract_expiring'
));
