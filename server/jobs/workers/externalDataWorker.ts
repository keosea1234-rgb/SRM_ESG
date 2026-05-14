import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis.js';
import logger from '../../shared/logger.js';

export interface ExternalDataJobData {
  supplierId: string;
  provider: 'dnb' | 'integrityNext' | 'ecovadis';
  triggeredBy?: 'scheduler' | 'manual';
}

async function processExternalData(job: Job<ExternalDataJobData>): Promise<void> {
  const { supplierId, provider } = job.data;
  logger.info({ jobId: job.id, supplierId, provider }, 'External data job started');

  await job.updateProgress(10);

  // TODO: Sprint 4 — plug in ESGProviderAdapter here
  // const adapter = AdapterRegistry.get(provider);
  // const data = await adapter.fetch(supplierId);
  // const normalized = adapter.normalize(data);
  // await adapter.persist(supplierId, normalized);

  logger.info({ jobId: job.id, supplierId, provider }, 'External data job placeholder complete');
  await job.updateProgress(100);
}

export function startExternalDataWorker(): Worker<ExternalDataJobData> {
  const worker = new Worker<ExternalDataJobData>(
    'external-data',
    processExternalData,
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'External data job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'External data job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'External data worker error');
  });

  logger.info('External data worker started');
  return worker;
}
