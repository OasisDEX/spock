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
