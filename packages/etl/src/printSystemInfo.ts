import { getVersion } from './utils/getVersion';
import { SpockConfig } from './config';
import { getLogger } from './utils/logger';
import { omit } from 'lodash';

const logger = getLogger('system');

export function printSystemInfo(config: SpockConfig): void {
  logger.info(`Starting Spock ETL ver.${getVersion()}`);
  logger.info('Config:', maskConfig(config));
}

function maskConfig(config: SpockConfig): Object {
  return {
    ...omit(config, 'sentry', 'onStart'),
    extractors: (config.extractors || []).map(e => e.name),
    transformers: (config.transformers || []).map(t => t.name),
    db: {
      host: config.db.host,
    },
  };
}
