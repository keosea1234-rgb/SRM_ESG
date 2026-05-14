import { Queue, QueueOptions } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import logger from '../shared/logger.js';

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

// Queue definitions
export const dailySnapshotQueue = new Queue('daily-snapshot', defaultQueueOptions);
export const externalDataQueue = new Queue('external-data', defaultQueueOptions);

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  logger.info('Closing BullMQ queues...');
  await Promise.all([
    dailySnapshotQueue.close(),
    externalDataQueue.close(),
  ]);
  logger.info('BullMQ queues closed');
}