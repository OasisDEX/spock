import { etl } from '../etl';
import { loadConfig } from '../utils/configUtils';
import { captureException, flush } from '@sentry/node';

export async function main(): Promise<void> {
  const config = loadConfig();

  await etl(config);
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
