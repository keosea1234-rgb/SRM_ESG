CREATE TABLE public.srm_daily_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date date NOT NULL UNIQUE,
    total_suppliers integer NOT NULL DEFAULT 0,
    active_suppliers integer NOT NULL DEFAULT 0,
    avg_performance_score numeric(5,2),
    high_risk_count integer NOT NULL DEFAULT 0,
    expiring_docs_count integer NOT NULL DEFAULT 0,
    active_contracts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.srm_daily_snapshots IS 'Daily snapshot of key SRM metrics for trend analysis and sparklines';

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON srm_daily_snapshots(snapshot_date DESC);

ALTER TABLE public.srm_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select srm_daily_snapshots"
ON public.srm_daily_snapshots
FOR SELECT
TO authenticated
USING (true);
