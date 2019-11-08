import * as Sentry from '@sentry/node';

import { getLogger } from './utils/logger';
import { getRequiredString } from './utils/configUtils';

const logger = getLogger('sentry');

export function setupSentry(): void {
  const env = process.env;
  const sentryDSN = getRequiredString(env, 'SENTRY_DSN');
  const sentryEnv = getRequiredString(env, 'SENTRY_ENV');

  if (env.SENTRY_DSN) {
    logger.info(`Enabling Sentry integration (env=${sentryEnv}, dsn=${sentryDSN})`);

    Sentry.init({
      dsn: sentryDSN,
      environment: sentryEnv,
    });
  } else {
    logger.warn('Sentry disabled');
  }
}
