import { blockGenerator } from '../blockGenerator';
import { createDB } from '../db/db';
import { ethers } from 'ethers';
import { Block } from 'ethers/providers';
import { testConfig, prepareDB, dumpDB } from '../../test/common';
import { Services } from '../types';
import { pick } from 'lodash';
import { createProviders, getRandomProvider } from '../services';
import { delay } from '../utils';

describe('Whole solution', () => {
  it('should work with reorgs', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    const blocks: Array<Partial<ethers.providers.Block>> = [
      {
        hash: '0x00',
        number: 0,
        parentHash: '0x0000',
        timestamp: 0,
      },
      {
        hash: '0x01',
        number: 1,
        parentHash: '0x00',
        timestamp: 1,
      },
      {
        hash: '0x02',
        number: 2,
        parentHash: '0x 01',
        timestamp: 2,
      },
      {
        hash: '0x03',
        number: 3,
        parentHash: '0x002',
        timestamp: 3,
      },
      {
        hash: '0x01',
        number: 1,
        parentHash: '0x00',
        timestamp: 1,
      },
      {
        hash: '0x002',
        number: 2,
        parentHash: '0x01',
        timestamp: 2,
      },
      {
        hash: '0x003',
        number: 3,
        parentHash: '0x002',
        timestamp: 3,
      },
    ];
    let blockPointer = 0;

    createProviders({
      chain: {
        host: 'http://localhost/not-existing',
        name: 'mainnet',
        retries: 0,
      },
    } as any);
    const provider = getRandomProvider();

    provider.getBlock = async (blockNumber: number): Promise<Block> => {
      const block = blocks[blockPointer++];
      if (block && block.number !== blockNumber) {
        throw new Error('Error in fixtures!');
      }
      return block as any;
    };

    const services: Services = {
      config: testConfig,
      provider: provider,
      ...dbCtx,
      networkState: {
        latestEthereumBlockOnStart: 1,
      },
    };

    runBlockGenerator(services).catch(() => {
      process.exit(1);
    });
    await delay(4000);

    expect(pick(await dumpDB(dbCtx.db), 'blocks')).toMatchInlineSnapshot(`
Object {
  "blocks": Array [
    Object {
      "hash": "0x00",
      "id": 1,
      "number": 0,
      "timestamp": 1970-01-01T00:00:00.000Z,
    },
    Object {
      "hash": "0x01",
      "id": 3,
      "number": 1,
      "timestamp": 1970-01-01T00:00:01.000Z,
    },
    Object {
      "hash": "0x002",
      "id": 4,
      "number": 2,
      "timestamp": 1970-01-01T00:00:02.000Z,
    },
    Object {
      "hash": "0x003",
      "id": 5,
      "number": 3,
      "timestamp": 1970-01-01T00:00:03.000Z,
    },
  ],
}
`);
  });
});

async function runBlockGenerator(service: Services): Promise<void> {
  await new Promise<void>(async (resolve, reject) => {
    try {
      const provider = {
        ...service.provider,
        on(eventName: string): void {
          // this means that block generator waits for new blocks so we resolve the promise to continue execution of a test file
          if (eventName === 'block') {
            resolve();
          }
        },
      };

      const services: Services = {
        ...service,
        provider: provider as any,
      };

      await blockGenerator(services, 0);
    } catch (e) {
      reject(e);
    }
  });
}
