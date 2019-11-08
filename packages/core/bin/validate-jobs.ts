import { captureException, flush } from '@sentry/node';

import { validateJobs } from '../../validate/validateJobs';
import { loadConfig } from '../utils/configUtils';

/**
 * Validates logs data against GBQ
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await validateJobs(config);
}

//tslint:disable-next-line
main()
  .catch(async e => {
    console.error(e);

    captureException(e);
    // need for sentry to send async requests
    await flush();
  })
  .finally(() => {
    process.exit(1);
  });
