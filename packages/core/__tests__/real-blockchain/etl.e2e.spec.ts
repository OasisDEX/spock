import { etl } from '../../etl';
import {
  makeRawLogExtractors,
  getExtractorName,
} from '../../processors/extractors/instances/rawEventDataExtractor';
import { dumpDB, testConfig, prepareDB } from '../../../test/common';
import { createDB } from '../../db/db';
import { mergeConfig } from '../../utils/configUtils';
import { delay } from '../../utils';
import { pick, omit, sortBy, flatten } from 'lodash';
import { join } from 'path';
import { BlockTransformer } from '../../processors/types';
import { UserProvidedSpockConfig } from '../../config';

const DAI = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';

describe('Spock ETL', () => {
  it('should work for past events', async () => {
    jest.setTimeout(1000 * 60);

    setupEnv();
    const startingBlock = 8219360;
    const dump = await runIntegrationTest({
      startingBlock,
      lastBlock: startingBlock + 40,
      extractors: [...makeRawLogExtractors([DAI])],
      transformers: [daiTransformer],
      migrations: {},
    });

    expect(pick(dump, ['blocks', 'extracted_logs'])).toMatchSnapshot();
    expect(sortBy(allDaiData, ['block_id', 'log_index'])).toMatchSnapshot();
  });
});

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

function setupEnv(): void {
  const chainHost = process.env['VL_CHAIN_HOST'];
  require('dotenv').config({ path: join(__dirname, '../../../../.env.local') });
  require('dotenv').config({ path: join(__dirname, '../../../../.env') });
  // prefer chainHost definition from the environment
  process.env['VL_CHAIN_HOST'] = chainHost || process.env['VL_CHAIN_HOST'];
}

let allDaiData: any = [];
const daiTransformer: BlockTransformer = {
  name: 'DAI-transformer',
  dependencies: [getExtractorName(DAI)],
  transform: async (_s, data) => {
    const deterministicData = flatten(data).map(d => omit(d, 'tx_id'));
    allDaiData.push(...deterministicData);
  },
};
