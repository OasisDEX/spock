import { createDB } from '../db/db';
import { prepareDB, testConfig, executeSQL } from '../../test/common';
import { Services } from '../types';
import { getNextBlocks, BlockExtractor } from './extractor';

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

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'new');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'new');
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
    };

    const actual = await getNextBlocks(services, blockExtractor);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "extracted_block_id": 1,
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
  },
  Object {
    "extracted_block_id": 2,
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

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'new');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'new');
    `,
    );

    const blockExtractor: BlockExtractor = {
      name: 'test-extractor',
      extractorDependencies: ['test-extractor-2'],
      extract: async () => {},
      getData: async () => ({}),
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
    };

    const actual = await getNextBlocks(services, blockExtractor);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "extracted_block_id": 1,
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
  },
]
`);
  });
});
