import { createDB } from '../db/db';
import { prepareDB, testConfig, executeSQL } from '../../test/common';
import { Services } from '../types';
import { getNextBlocks, BlockExtractor } from './extractor';
import { registerProcessors } from './register';

describe('extractors > getNextBlocks', () => {
  it('should work with extractors without dependencies', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
    `,
    );

    const blockExtractor: BlockExtractor = {
      name: 'test-extractor',
      extract: async () => {},
      getData: async () => ({}),
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
      networkState: {
        latestEthereumBlockOnStart: 0,
      },
    };

    await registerProcessors(services, [blockExtractor]);

    const actual = await getNextBlocks(services, blockExtractor);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
  },
  Object {
    "hash": "0x02",
    "id": 2,
    "number": 2,
    "timestamp": 2019-07-02T11:18:02.000Z,
  },
]
`);
  });

  it('should work with extractors with dependencies', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
    `,
    );

    const blockExtractor: BlockExtractor = {
      name: 'test-extractor',
      extractorDependencies: ['test-extractor-2'],
      extract: async () => {},
      getData: async () => ({}),
    };
    const blockExtractor2: BlockExtractor = {
      name: 'test-extractor-2',
      extract: async () => {},
      getData: async () => ({}),
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
      networkState: {
        latestEthereumBlockOnStart: 0,
      },
    };

    await registerProcessors(services, [blockExtractor, blockExtractor2]);
    await executeSQL(
      dbCtx.db,
      `
      -- update like there was some work already done
      UPDATE vulcan2x.job SET last_block_id = 1 WHERE name='test-extractor-2';
    `,
    );

    const actual = await getNextBlocks(services, blockExtractor);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
  },
]
`);
  });
});
