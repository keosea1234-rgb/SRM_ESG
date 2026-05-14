import pino from 'pino';
import * as Sentry from '@sentry/node';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export function getRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}

export default {
  info: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') return logger.info(obj);
    logger.info(obj, msg);
  },
  warn: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') return logger.warn(obj);
    logger.warn(obj, msg);
  },
  error: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      logger.error(obj);
      Sentry.captureMessage(obj, 'error');
      return;
    }
    logger.error(obj, msg);
    const err = (obj as { err?: Error }).err;
    if (err instanceof Error) {
      Sentry.captureException(err);
    } else {
      Sentry.captureMessage(msg ?? JSON.stringify(obj), 'error');
    }
  },
  fatal: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      logger.fatal(obj);
      Sentry.captureMessage(obj, 'fatal');
      return;
    }
    logger.fatal(obj, msg);
    const err = (obj as { err?: Error }).err;
    if (err instanceof Error) {
      Sentry.captureException(err);
    } else {
      Sentry.captureMessage(msg ?? JSON.stringify(obj), 'fatal');
    }
  },
};
