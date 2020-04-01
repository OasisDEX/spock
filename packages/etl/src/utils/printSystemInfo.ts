import { SpockConfig } from '../services/config'
import { getLogger } from './logger'
import { omit } from 'lodash'

const logger = getLogger('system')

export function printSystemInfo(config: SpockConfig): void {
  logger.info(`Starting Spock ETL ver.${getVersion()}`)
  logger.info('Config:', maskConfig(config))
}

function maskConfig(config: SpockConfig): Record<string, any> {
  return {
    ...omit(config, 'sentry', 'onStart'),
    // printout simplified extractors/transformers config
    extractors: (config.extractors || []).map((e) => e.name),
    transformers: (config.transformers || []).map((t) => t.name),
    // avoid printing out password
    db: {
      host: config.db.host,
    },
  }
}

export function getVersion(): string {
  return (require('../../package.json') || {}).version
}
