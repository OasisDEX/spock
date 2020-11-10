import * as Sentry from '@sentry/node'

import { getRequiredString } from '../services/configUtils'
import { getLogger } from './logger'

const logger = getLogger('sentry')

export function setupSentry(): void {
  const env = process.env
  const sentryDSN = env.SENTRY_DSN

  if (env.SENTRY_DSN) {
    const sentryEnv = getRequiredString(env, 'SENTRY_ENV')
    logger.info(`Enabling Sentry integration (env=${sentryEnv}, dsn=${sentryDSN})`)

    Sentry.init({
      dsn: sentryDSN,
      environment: sentryEnv,
    })
  } else {
    logger.warn('Sentry disabled')
  }
}
