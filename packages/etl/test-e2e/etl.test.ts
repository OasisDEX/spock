import { join } from 'path';
import { expect } from 'chai';

import { withLocalEnv, runIntegrationTest } from 'spock-test-utils';

import { BlockExtractor } from '../src/processors/types';
import { TransactionalServices } from '../src/types';
import { BlockModel } from '../src/db/models/Block';
import { Log } from 'ethers/providers';
import { getLast } from '../src/utils';

const DAI = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';

const allDaiLogs: any[] = [];

const simpleDaiLogExtractor: BlockExtractor = {
  name: 'simple-log-extractor',
  async extract(services, blocks) {
    const logs = await getLogs(services, blocks, DAI);
    allDaiLogs.push(...logs);
  },
  async getData(_services, _blocks) { },
};

export async function getLogs(
  services: TransactionalServices,
  blocks: BlockModel[],
  address: string[] | string,
): Promise<Log[]> {
  if (blocks.length === 0) {
    return [];
  } else {
    const fromBlock = blocks[0].number;
    const toBlock = getLast(blocks)!.number;

    return await services.provider.getLogs({
      address,
      fromBlock,
      toBlock,
    });
  }
}

// @todo redesign this test:
// - use transformer
// - put real data to database

describe('Spock ETL', () => {
  it('should work for past events', async () => {
    const startingBlock = 8219360;
    const lastBlock = startingBlock + 40;

    await withLocalEnv(join(__dirname, '../../../'), async () => {
      await runIntegrationTest({
        startingBlock,
        lastBlock,
        extractors: [simpleDaiLogExtractor],
        transformers: [],
        migrations: {},
      });

      expect(allDaiLogs.length).to.be.eq(52);
    });
  });
});
