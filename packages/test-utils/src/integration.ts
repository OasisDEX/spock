import { merge } from 'lodash';

import { UserProvidedSpockConfig } from 'spock-etl/src/config';
import { createDB, DB } from 'spock-etl/src/db/db';
import { mergeConfig } from 'spock-etl/src/utils/configUtils';
import { etl, startETL } from 'spock-etl/dist/etl';
import { delay, setSpockBreakout, resetSpockBreakout } from 'spock-etl/src/utils';

import { getTestConfig, createTestServices } from './services';
import { prepareDB, dumpDB } from './db';
import { Services } from 'spock-etl/dist/types';
import { getDefaultConfig } from 'spock-etl/dist/config';

export async function runIntegrationTest(
  externalConfig: UserProvidedSpockConfig,
): Promise<Services> {
  const services = await createTestServices({
    config: mergeConfig({ ...externalConfig, statsWorker: { enabled: false } }),
  });

  const etlPromise = startETL(services);

  etlPromise.catch((e) => {
    console.error('ETL FAILED WITH', e);
    process.exit(1);
  });

  await waitForAllJobs(services, etlPromise);

  return services;
}

export async function waitForAllJobs(services: Services, etl: Promise<void>) {
  const { config } = services;
  const allJobs = config.extractors.length + config.transformers.length;
  const lastBlockId = config.lastBlock! - config.startingBlock; // ids are starting from 1
  let fullySynced = false;
  while (!fullySynced) {
    await delay(1000);
    const jobs = (await dumpDB(services.db)).job;
    fullySynced = jobs.filter((p) => p.last_block_id >= lastBlockId).length === allJobs;
  }
  setSpockBreakout();

  await etl;
}
