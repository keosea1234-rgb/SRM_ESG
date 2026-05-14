-- Migration 004: Dashboard materialized views
-- Replaces heavy application-layer joins in dashboard.repository.ts
-- with pre-computed views refreshed by the daily snapshot worker.

-- ============================================================
-- VIEW 1: mv_supplier_dashboard_summary
-- Replaces: getTopSuppliers() — 4 parallel queries + JS join
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_supplier_dashboard_summary AS
SELECT
  s.id                                          AS supplier_id,
  s.name                                        AS supplier_name,
  s.onboarding_status,
  pe.overall_score                              AS latest_score,
  pe.evaluation_period                          AS latest_eval_period,
  ra.overall_risk_level                         AS current_risk_level,
  ra.assessment_date                            AS latest_risk_date,
  COUNT(DISTINCT c.id)::int                     AS contract_count
FROM srm_suppliers s
LEFT JOIN LATERAL (
  SELECT overall_score, evaluation_period
  FROM srm_performance_evaluations
  WHERE supplier_id = s.id
  ORDER BY evaluation_period DESC
  LIMIT 1
) pe ON true
LEFT JOIN LATERAL (
  SELECT overall_risk_level, assessment_date
  FROM srm_risk_assessments
  WHERE supplier_id = s.id
  ORDER BY assessment_date DESC
  LIMIT 1
) ra ON true
LEFT JOIN contracts c ON c.supplier_id = s.id
GROUP BY
  s.id, s.name, s.onboarding_status,
  pe.overall_score, pe.evaluation_period,
  ra.overall_risk_level, ra.assessment_date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_supplier_dashboard_summary_id
  ON mv_supplier_dashboard_summary (supplier_id);

CREATE INDEX IF NOT EXISTS idx_mv_supplier_dashboard_summary_score
  ON mv_supplier_dashboard_summary (latest_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_mv_supplier_dashboard_summary_risk
  ON mv_supplier_dashboard_summary (current_risk_level);

-- ============================================================
-- VIEW 2: mv_supplier_score_trend
-- Replaces: getDecliningSuppliers() — full table scan + JS grouping
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_supplier_score_trend AS
SELECT
  curr.supplier_id,
  s.name                                        AS supplier_name,
  curr.overall_score                            AS latest_score,
  prev.overall_score                            AS previous_score,
  curr.overall_score - prev.overall_score       AS score_delta,
  curr.evaluation_period                        AS latest_period,
  prev.evaluation_period                        AS previous_period
FROM (
  SELECT DISTINCT ON (supplier_id)
    supplier_id, overall_score, evaluation_period
  FROM srm_performance_evaluations
  ORDER BY supplier_id, evaluation_period DESC
) curr
JOIN (
  SELECT DISTINCT ON (supplier_id)
    supplier_id, overall_score, evaluation_period
  FROM srm_performance_evaluations
  ORDER BY supplier_id, evaluation_period DESC OFFSET 0
) prev ON prev.supplier_id = curr.supplier_id
  AND prev.evaluation_period < curr.evaluation_period
JOIN srm_suppliers s ON s.id = curr.supplier_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_supplier_score_trend_id
  ON mv_supplier_score_trend (supplier_id);

CREATE INDEX IF NOT EXISTS idx_mv_supplier_score_trend_delta
  ON mv_supplier_score_trend (score_delta ASC);

-- ============================================================
-- REFRESH FUNCTION
-- Called by dailySnapshotWorker after snapshot insert
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_score_trend;
END;
$$;

-- ============================================================
-- GRANT access to authenticated role
-- ============================================================
GRANT SELECT ON mv_supplier_dashboard_summary TO authenticated;
GRANT SELECT ON mv_supplier_score_trend TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_views() TO authenticated;
