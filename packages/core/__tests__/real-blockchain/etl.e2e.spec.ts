import { etl } from '../../etl';
import { makeRawLogExtractors } from '../../extractors/instances/rawEventDataExtractor';
import { dumpDB, testConfig, prepareDB } from '../../../test/common';
import { createDB } from '../../db/db';
import { mergeConfig } from '../../utils/configUtils';
import { delay } from '../../utils';
import { pick } from 'lodash';
import { join } from 'path';

const DAI = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';

describe('Spock ETL', () => {
  it('should work for past events', async () => {
    jest.setTimeout(1000 * 60);

    setupEnv();

    const startingBlock = 8219360;

    const config: any = mergeConfig({
      startingBlock: startingBlock,
      lastBlock: startingBlock + 40,
      extractors: [...makeRawLogExtractors([DAI])],
      transformers: [],
    });

    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    etl(config).catch(e => {
      console.log('ETL FAILED WITH ', e);
      process.exit(1);
    });

    await delay(20 * 1000);

    const dump = await dumpDB(dbCtx.db);

    expect(pick(dump, ['blocks', 'extracted_logs'])).toMatchSnapshot();
  });
});

function setupEnv(): void {
  const chainHost = process.env['VL_CHAIN_HOST'];
  require('dotenv').config({ path: join(__dirname, '../../../../.env.local') });
  require('dotenv').config({ path: join(__dirname, '../../../../.env') });
  // prefer chainHost definition from the environment
  process.env['VL_CHAIN_HOST'] = chainHost || process.env['VL_CHAIN_HOST'];
}
