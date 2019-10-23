import * as Sentry from '@sentry/node';

import { SpockConfig } from './config';
import { getLogger } from './utils/logger';

const logger = getLogger('sentry');

export function setupSentry(config: SpockConfig): void {
  if (config.sentry) {
    logger.info(`Enabling Sentry integration (env=${config.sentry.environment})`);

    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
    });
  } else {
    logger.warn('Sentry disabled');
  }
}
