import logger from '../shared/logger.js';
import { dailySnapshotQueue } from './queue.js';

const DAILY_SNAPSHOT_CRON = '0 2 * * *';

export async function startScheduler(): Promise<void> {
  const existingJobs = await dailySnapshotQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await dailySnapshotQueue.removeRepeatableByKey(job.key);
  }

  await dailySnapshotQueue.add(
    'daily-snapshot',
    { triggeredBy: 'scheduler' },
    {
      repeat: { pattern: DAILY_SNAPSHOT_CRON },
      jobId: 'daily-snapshot-recurring',
    }
  );

  logger.info({ cron: DAILY_SNAPSHOT_CRON }, 'Daily snapshot scheduler started');
}
