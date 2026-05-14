-- Scoring engine version tracking
ALTER TABLE srm_esg_assessments
  ADD COLUMN IF NOT EXISTS scoring_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS scoring_weights jsonb NOT NULL DEFAULT
    '{"env": 0.50, "social": 0.20, "gov": 0.30}'::jsonb;

COMMENT ON COLUMN srm_esg_assessments.scoring_version IS
  'Version of scoring engine used to compute scores. Bump when weights or formulas change.';
COMMENT ON COLUMN srm_esg_assessments.scoring_weights IS
  'Weight profile used at assessment time. Preserved for audit trail.';

-- Backfill existing records
UPDATE srm_esg_assessments
SET scoring_version = 'v1',
    scoring_weights = '{"env": 0.50, "social": 0.20, "gov": 0.30}'::jsonb
WHERE scoring_version IS NULL OR scoring_version = 'v1';
