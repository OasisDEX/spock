import * as Sentry from '@sentry/node';

import { SpockConfig } from './config';
import { getLogger } from './utils/logger';

const logger = getLogger('sentry');

export function setupSentry(config: SpockConfig): void {
  if (config.sentry.dsn) {
    logger.info('Enabling Sentry integration');

    Sentry.init({
      dsn: config.sentry.dsn,
    });
  } else {
    logger.warn('Sentry disabled');
  }
}
