import { createDB } from '../db/db';
import { prepareDB, testConfig, executeSQL } from '../../test/common';
import { Services } from '../types';
import { getNextBlocks, BlockTransformer } from './transformers';

describe('transformers > getNextBlocks', () => {
  it('should work with transformers with extractor dependencies', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'new');

      -- add tasks for transforming
      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(1, 'test-transformer', 'new');
      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(2, 'test-transformer', 'new');
    `,
    );

    const blockTransformer: BlockTransformer = {
      name: 'test-transformer',
      dependencies: ['test-extractor'],
      transform: async () => {},
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
    };

    const actual = await getNextBlocks(services, blockTransformer);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
    "transformed_block_id": 1,
  },
]
`);
  });

  it('should work with transformers with extractor and transformer dependencies', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'done');

      -- add tasks for transforming
      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(1, 'test-transformer', 'done');
      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(2, 'test-transformer', 'new');

      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(1, 'test-transformer-2', 'new');
      INSERT INTO vulcan2x.transformed_block(block_id, transformer_name, status) VALUES(2, 'test-transformer-2', 'new');
    `,
    );

    const blockTransformer: BlockTransformer = {
      name: 'test-transformer-2',
      dependencies: ['test-extractor'],
      transformerDependencies: ['test-transformer'],
      transform: async () => {},
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
    };

    const actual = await getNextBlocks(services, blockTransformer);

    expect(actual).toMatchInlineSnapshot(`
Array [
  Object {
    "hash": "0x01",
    "id": 1,
    "number": 1,
    "timestamp": 2019-07-02T11:18:01.000Z,
    "transformed_block_id": 3,
  },
]
`);
  });
});
