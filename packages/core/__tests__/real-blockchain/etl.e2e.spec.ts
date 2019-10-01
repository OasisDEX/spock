import {
  makeRawLogExtractors,
  getExtractorName,
} from '../../processors/extractors/instances/rawEventDataExtractor';
import { pick, omit, sortBy, flatten } from 'lodash';
import { join } from 'path';
import { BlockTransformer } from '../../processors/types';
import { runIntegrationTest } from '../../../test/common-utils';

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
