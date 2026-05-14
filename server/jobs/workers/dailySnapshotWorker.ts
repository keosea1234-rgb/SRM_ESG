import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis.js';
import logger from '../../shared/logger.js';
import { supabase } from '../../db/supabaseClient.js';
import { checkAndCreateAlerts, runPostSnapshotAlerts } from '../../modules/alerts/alerts.service.js';

export interface DailySnapshotJobData {
  triggeredBy?: 'scheduler' | 'manual';
  date?: string;
}

async function processDailySnapshot(job: Job<DailySnapshotJobData>): Promise<void> {
  const targetDate = job.data.date ?? new Date().toISOString().split('T')[0];
  logger.info({ jobId: job.id, targetDate }, 'Daily snapshot job started');

  await job.updateProgress(10);

  const { data: suppliers, error: suppliersError } = await supabase
    .from('srm_suppliers')
    .select('id, status');
  if (suppliersError) throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);

  const totalSuppliers = suppliers?.length ?? 0;
  const activeSuppliers = suppliers?.filter(s => s.status === 'active').length ?? 0;

  await job.updateProgress(30);

  const { data: perfData, error: perfError } = await supabase
    .from('srm_performance_evaluations')
    .select('supplier_id, overall_score, evaluation_period')
    .order('evaluation_period', { ascending: false });
  if (perfError) logger.warn({ perfError }, 'Failed to fetch performance data for snapshot');

  const latestBySupplier = new Map<string, number>();
  for (const row of perfData ?? []) {
    if (!latestBySupplier.has(row.supplier_id) && row.overall_score != null) {
      latestBySupplier.set(row.supplier_id, row.overall_score);
    }
  }
  const scores = Array.from(latestBySupplier.values());
  const avgPerformanceScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null;

  await job.updateProgress(50);

  const { data: riskData, error: riskError } = await supabase
    .from('srm_risk_assessments')
    .select('supplier_id, overall_risk_level, assessment_date')
    .order('assessment_date', { ascending: false });
  if (riskError) logger.warn({ riskError }, 'Failed to fetch risk data for snapshot');

  const latestRiskBySupplier = new Map<string, string>();
  for (const row of riskData ?? []) {
    if (!latestRiskBySupplier.has(row.supplier_id)) {
      latestRiskBySupplier.set(row.supplier_id, row.overall_risk_level ?? 'low');
    }
  }
  const highRiskCount = Array.from(latestRiskBySupplier.values())
    .filter(l => l === 'high' || l === 'critical').length;

  await job.updateProgress(70);

  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const { count: expiringDocsCount } = await supabase
    .from('srm_supplier_documents')
    .select('id', { count: 'exact', head: true })
    .lte('expiry_date', in30Days)
    .gte('expiry_date', targetDate);

  const { count: activeContracts } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  await job.updateProgress(90);

  const { error: insertError } = await supabase
    .from('srm_daily_snapshots')
    .upsert({
      snapshot_date: targetDate,
      total_suppliers: totalSuppliers,
      active_suppliers: activeSuppliers,
      avg_performance_score: avgPerformanceScore,
      high_risk_count: highRiskCount,
      expiring_docs_count: expiringDocsCount ?? 0,
      active_contracts: activeContracts ?? 0,
    }, { onConflict: 'snapshot_date' });
  if (insertError) throw new Error(`Failed to insert snapshot: ${insertError.message}`);

  try {
    const { created: snapshotAlertsCreated } = await runPostSnapshotAlerts(targetDate);
    logger.info({ snapshotAlertsCreated, targetDate }, 'Post-snapshot supplier alerts');
  } catch (err) {
    logger.warn({ err, targetDate }, 'Post-snapshot alert generation failed');
  }

  const { error: refreshError } = await supabase.rpc('refresh_dashboard_views');
  if (refreshError) logger.warn({ refreshError }, 'Failed to refresh dashboard views');

  const { data: alertSuppliers, error: activeSuppliersError } = await supabase
    .from('srm_suppliers')
    .select('id')
    .eq('status', 'active');
  if (activeSuppliersError) {
    logger.warn({ activeSuppliersError }, 'Failed to fetch active suppliers for alert checks');
  } else {
    for (const s of alertSuppliers ?? []) {
      await checkAndCreateAlerts(s.id).catch((err) =>
        logger.warn({ err, supplierId: s.id }, "alert check failed")
      );
    }
  }

  await job.updateProgress(100);
  logger.info({ jobId: job.id, targetDate, totalSuppliers, activeSuppliers, highRiskCount }, 'Daily snapshot completed');
}

export function startDailySnapshotWorker() {
  const worker = new Worker<DailySnapshotJobData>(
    'daily-snapshot',
    processDailySnapshot,
    { connection: redisConnection }
  );
  worker.on('completed', job => logger.info({ jobId: job.id }, 'Daily snapshot completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Daily snapshot failed'));
  return worker;
}
