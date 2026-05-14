-- RPC: portfolio-level ESG aggregates
-- Replaces Node.js aggregation in esg.service.ts -> getEsgSummary()
CREATE OR REPLACE FUNCTION get_esg_portfolio_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'avg_esg',    ROUND(AVG(overall_esg_score)),
    'avg_env',    ROUND(AVG(env_score)),
    'avg_social', ROUND(AVG(social_score)),
    'avg_gov',    ROUND(AVG(gov_score)),
    'total',      COUNT(*),
    'avg_renewable_energy_pct',   ROUND(AVG(renewable_energy_pct)::numeric, 1),
    'avg_waste_recycling_pct',    ROUND(AVG(waste_recycling_pct)::numeric, 1),
    'avg_carbon_footprint_tons',  ROUND(AVG(carbon_footprint_tons)::numeric, 1),
    'avg_water_usage_m3',         ROUND(AVG(water_usage_m3)::numeric, 1),
    'avg_women_in_mgmt_pct',      ROUND(AVG(women_in_mgmt_pct)::numeric, 1),
    'avg_lost_time_injury_rate',  ROUND(AVG(lost_time_injury_rate)::numeric, 2),
    'living_wage_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE living_wage_compliant = true)
            / NULLIF(COUNT(*) FILTER (WHERE living_wage_compliant IS NOT NULL), 0)),
    'child_labor_policy_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE child_labor_policy = true)
            / NULLIF(COUNT(*) FILTER (WHERE child_labor_policy IS NOT NULL), 0)),
    'anti_corruption_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE anti_corruption_policy = true)
            / NULLIF(COUNT(*) FILTER (WHERE anti_corruption_policy IS NOT NULL), 0)),
    'independent_audit_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE independent_audit = true)
            / NULLIF(COUNT(*) FILTER (WHERE independent_audit IS NOT NULL), 0)),
    'gdpr_compliant_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE gdpr_compliant = true)
            / NULLIF(COUNT(*) FILTER (WHERE gdpr_compliant IS NOT NULL), 0)),
    'avg_data_breach_incidents',  ROUND(AVG(data_breach_incidents)::numeric, 1)
  )
  FROM srm_esg_assessments
  WHERE status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION get_esg_portfolio_summary() TO authenticated;
