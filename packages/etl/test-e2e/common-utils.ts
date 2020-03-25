import { join } from 'path';

import { UserProvidedSpockConfig } from '../src/config';
import { createDB, DB } from '../src/db/db';
import { dumpDB, prepareDB, testConfig } from './common';
import { mergeConfig } from '../src/utils/configUtils';
import { etl } from '../src/etl';
import { delay, setSpockBreakout, resetSpockBreakout } from '../src/utils';

export async function runIntegrationTest(externalConfig: UserProvidedSpockConfig): Promise<DB> {
  const config = mergeConfig({ ...externalConfig, statsWorker: { enabled: false } });

  if (!config.lastBlock) {
    throw new Error("You need to specify 'lastBlock' during tests!");
  }

  const dbCtx = createDB(testConfig.db);
  await prepareDB(dbCtx.db, config);
  resetSpockBreakout();

  const etlTask = etl(config).catch(e => {
    console.error('ETL FAILED WITH ', e);
    process.exit(1);
  });

  // wait till all jobs processed final block
  const allJobs = config.extractors.length + config.transformers.length;
  const lastBlockId = config.lastBlock - config.startingBlock; // ids are starting from 1
  let fullySynced = false;
  while (!fullySynced) {
    await delay(1000);
    const jobs = (await dumpDB(dbCtx.db)).job;
    fullySynced = jobs.filter(p => p.last_block_id >= lastBlockId).length === allJobs;
  }
  setSpockBreakout();

  await etlTask;

  return dbCtx.db;
}

export async function withLocalEnv<T>(envDir: string, fn: () => Promise<T> | T): Promise<T> {
  const backupEnv = { ...process.env };

  const chainHost = process.env['VL_CHAIN_HOST'];
  const localEnvPath = join(envDir, '.env.local');
  require('dotenv').config({ path: localEnvPath });
  const envPath = join(envDir, '.env');
  require('dotenv').config({ path: envPath });
  // prefer chainHost definition from the external environment
  process.env['VL_CHAIN_HOST'] = chainHost || process.env['VL_CHAIN_HOST'];

  const r = await fn();

  process.env = backupEnv;

  return r;
}
