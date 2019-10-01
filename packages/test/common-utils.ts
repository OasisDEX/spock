import { UserProvidedSpockConfig } from '../core/config';
import { createDB } from '../core/db/db';
import { dumpDB, prepareDB, testConfig } from './common';
import { mergeConfig } from '../core/utils/configUtils';
import { etl } from '../core/etl';
import { delay } from '../core/utils';

export async function runIntegrationTest(
  externalConfig: UserProvidedSpockConfig,
): ReturnType<typeof dumpDB> {
  const config = mergeConfig(externalConfig);

  if (!config.lastBlock) {
    throw new Error("You need to specify 'lastBlock' during tests!");
  }

  const dbCtx = createDB(testConfig.db);
  await prepareDB(dbCtx.db, testConfig);

  etl(config).catch(e => {
    console.log('ETL FAILED WITH ', e);
    process.exit(1);
  });

  // wait till all jobs processed final block
  const allJobs = config.extractors.length + config.transformers.length;
  const lastBlockId = config.lastBlock - config.startingBlock; // ids are starting from 1
  let fullySynced = false;
  while (!fullySynced) {
    await delay(1000);
    const jobs = (await dumpDB(dbCtx.db)).job;
    fullySynced = jobs.filter(p => p.last_block_id === lastBlockId).length === allJobs;
  }

  return await dumpDB(dbCtx.db);
}
