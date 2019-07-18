import { createDB } from '../db/db';
import { prepareDB, testConfig, executeSQL, dumpDB } from '../../test/common';
import { Services } from '../types';

import { archiveExtractor } from './archiver';
import { pick } from 'lodash';

describe('archiver', () => {
  it('should work', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x04', '2019-07-02 11:18:04+00');

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(4, 'test-extractor', 'new');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor-2', 'new');
    `,
    );

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

    await archive(services, 'test-extractor');
    await archive(services, 'test-extractor-2');

    const actual = await dumpDB(dbCtx.db);
    expect(pick(actual, ['done_extracted_blocks', 'extracted_blocks'])).toMatchInlineSnapshot(`
Object {
  "done_extracted_blocks": Array [
    Object {
      "end_block_id": 3,
      "extractor_name": "test-extractor",
      "start_block_id": 1,
    },
    Object {
      "end_block_id": 2,
      "extractor_name": "test-extractor-2",
      "start_block_id": 1,
    },
  ],
  "extracted_blocks": Array [
    Object {
      "block_id": 3,
      "extractor_name": "test-extractor-2",
      "status": "new",
    },
    Object {
      "block_id": 4,
      "extractor_name": "test-extractor",
      "status": "new",
    },
  ],
}
`);
  });

  it('should work with merging existing range', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(4, '0x04', '2019-07-02 11:18:04+00');

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(4, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor-2', 'new');
    `,
    );

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

    await archive(services, 'test-extractor');
    await archive(services, 'test-extractor-2');

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(5, '0x05', '2019-07-02 11:18:05+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(6, '0x06', '2019-07-02 11:18:06+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(7, '0x07', '2019-07-02 11:18:07+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(8, '0x08', '2019-07-02 11:18:08+00');

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(5, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(6, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(7, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(8, 'test-extractor', 'new');
    `,
    );

    await archive(services, 'test-extractor');
    await archive(services, 'test-extractor-2');

    const actual = await dumpDB(dbCtx.db);
    expect(pick(actual, ['done_extracted_blocks', 'extracted_blocks'])).toMatchInlineSnapshot(`
Object {
  "done_extracted_blocks": Array [
    Object {
      "end_block_id": 7,
      "extractor_name": "test-extractor",
      "start_block_id": 1,
    },
    Object {
      "end_block_id": 2,
      "extractor_name": "test-extractor-2",
      "start_block_id": 1,
    },
  ],
  "extracted_blocks": Array [
    Object {
      "block_id": 3,
      "extractor_name": "test-extractor-2",
      "status": "new",
    },
    Object {
      "block_id": 8,
      "extractor_name": "test-extractor",
      "status": "new",
    },
  ],
}
`);
  });

  it('should work with merging existing range with gap', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(4, '0x04', '2019-07-02 11:18:04+00');


      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(4, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(1, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(2, 'test-extractor-2', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(3, 'test-extractor-2', 'new');
    `,
    );

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

    await archive(services, 'test-extractor');
    await archive(services, 'test-extractor-2');

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(5, 'DELETE', '2019-07-02 11:18:05+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(5, '0x05', '2019-07-02 11:18:05+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(6, '0x06', '2019-07-02 11:18:06+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(7, '0x07', '2019-07-02 11:18:07+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(8, '0x08', '2019-07-02 11:18:08+00');
      DELETE FROM vulcan2x.block WHERE hash='DELETE';

      -- add tasks for extraction
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(6, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(7, 'test-extractor', 'done');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(8, 'test-extractor', 'new');
      INSERT INTO vulcan2x.extracted_block(block_id, extractor_name, status) VALUES(9, 'test-extractor', 'done');
      `,
    );
    await archive(services, 'test-extractor');
    await archive(services, 'test-extractor-2');

    const actual = await dumpDB(dbCtx.db);
    expect(pick(actual, ['done_extracted_blocks', 'extracted_blocks'])).toMatchInlineSnapshot(`
Object {
  "done_extracted_blocks": Array [
    Object {
      "end_block_id": 7,
      "extractor_name": "test-extractor",
      "start_block_id": 1,
    },
    Object {
      "end_block_id": 9,
      "extractor_name": "test-extractor",
      "start_block_id": 9,
    },
    Object {
      "end_block_id": 2,
      "extractor_name": "test-extractor-2",
      "start_block_id": 1,
    },
  ],
  "extracted_blocks": Array [
    Object {
      "block_id": 3,
      "extractor_name": "test-extractor-2",
      "status": "new",
    },
    Object {
      "block_id": 8,
      "extractor_name": "test-extractor",
      "status": "new",
    },
  ],
}
`);
  });
});

async function archive(_services: Services, extractorName: string): Promise<void> {
  await _services.db.tx(async tx => {
    const services = {
      ..._services,
      tx,
    };

    await archiveExtractor(services, extractorName);
  });
}
