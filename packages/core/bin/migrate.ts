import { flush, captureException } from '@sentry/node';

import { loadConfig } from '../utils/configUtils';
import { getLogger } from '../utils/logger';
import { migrateFromConfig } from './migrateUtils';

const logger = getLogger('migration');

export async function main(): Promise<void> {
  const config = loadConfig();

  await migrateFromConfig(config);
}

//tslint:disable-next-line
main()
  .catch(async e => {
    logger.error(e);

    captureException(e);
    // need for sentry to send async requests
    await flush();
  })
  .finally(() => {
    process.exit(1);
  });
