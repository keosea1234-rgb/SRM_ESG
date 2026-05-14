import { Queue, QueueOptions } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import logger from '../shared/logger.js';

function normalizeEnvFlag(value: string | undefined): string | null {
  if (value == null) return null;
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
}

export function areBackgroundJobsEnabled(): boolean {
  const disabled = normalizeEnvFlag(process.env.DISABLE_JOBS);
  if (disabled === 'true' || disabled === '1' || disabled === 'yes') return false;
  if (disabled === 'false' || disabled === '0' || disabled === 'no') return true;
  if (process.env.NODE_ENV === 'production') return true;
  return false;
}

const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s → 4s → 8s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
};

let dailySnapshotQueue: Queue | null = null;
let externalDataQueue: Queue | null = null;

function ensureJobsEnabled(): void {
  if (!areBackgroundJobsEnabled()) {
    throw new Error('Background jobs are disabled; queue clients are not available.');
  }
}

export function getDailySnapshotQueue(): Queue {
  ensureJobsEnabled();
  dailySnapshotQueue ??= new Queue('daily-snapshot', defaultQueueOptions);
  return dailySnapshotQueue;
}

export function getExternalDataQueue(): Queue {
  ensureJobsEnabled();
  externalDataQueue ??= new Queue('external-data', defaultQueueOptions);
  return externalDataQueue;
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  if (!dailySnapshotQueue && !externalDataQueue) {
    logger.info('No BullMQ queues to close');
    return;
  }

  logger.info('Closing BullMQ queues...');
  await Promise.all([
    dailySnapshotQueue?.close(),
    externalDataQueue?.close(),
  ]);
  dailySnapshotQueue = null;
  externalDataQueue = null;
  logger.info('BullMQ queues closed');
}
