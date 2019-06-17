import { blockGenerator, Services } from '../generator';
import { createDB } from '../db/db';
import { ethers } from 'ethers';
import { Block } from 'ethers/providers';
import { testConfig, prepareDB, dumpDB } from '../../test/common';
import { extract, queueNewBlocksToExtract, BlockExtractor } from '../extractors/extractor';
import { makeRawLogExtractors } from '../extractors/instances/rawEventDataExtractor';

describe('Block Generator', () => {
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

    const provider = new ethers.providers.JsonRpcProvider('http://localhost/not-existing');
    provider.getBlock = async (blockNumber: number): Promise<Block> => {
      const block = blocks[blockPointer++];
      if (block && block.number !== blockNumber) {
        throw new Error('Error in fixtures!');
      }
      return block as any;
    };

    const services = {
      config: testConfig,
      provider: provider as any,
      ...dbCtx,
    };

    const extractors = [...makeRawLogExtractors(['0x0'])];

    await Promise.all([runBlockGenerator(services, extractors), runWorkers(services, extractors)]);

    expect(await dumpDB(dbCtx.db)).toMatchInlineSnapshot(`
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
  "extracted_blocks": Array [
    Object {
      "block_id": 1,
      "extractor_name": "raw_log_0x0_extractor",
      "status": "error",
    },
    Object {
      "block_id": 3,
      "extractor_name": "raw_log_0x0_extractor",
      "status": "error",
    },
    Object {
      "block_id": 4,
      "extractor_name": "raw_log_0x0_extractor",
      "status": "error",
    },
    Object {
      "block_id": 5,
      "extractor_name": "raw_log_0x0_extractor",
      "status": "error",
    },
  ],
  "transaction": Array [],
}
`);
  });
});

async function runBlockGenerator(service: Services, extractors: BlockExtractor[]): Promise<void> {
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

      await blockGenerator(services, 0, (tx, blocks) => {
        return Promise.all([queueNewBlocksToExtract(tx, extractors, blocks)]);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function runWorkers(service: Services, extractors: BlockExtractor[]): Promise<void> {
  // @todo figure out a better way to realize that all blocks were processed. Maybe inspect processed blocks?
  await Promise.race([extract(service, extractors), delay(4000)]);
}

function delay(n: number): Promise<void> {
  return new Promise(resolve => setInterval(resolve, n));
}
