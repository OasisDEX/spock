import { createDB } from '../../db/db';
import { prepareDB, testConfig, dumpDB, networkState, executeSQL } from '../../../test/common';
import { Services } from '../../types';
import { registerProcessors } from '../register';
import { BlockExtractor } from '../types';
import { pick } from 'lodash';
import { getInitialProcessorsState } from '../state';

describe('register', () => {
  it('should register new processors', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    const extractor1: BlockExtractor = {
      name: 'test-extractor',
      extract: async () => {},
      getData: async () => ({}),
    };

    const extractor2: BlockExtractor = {
      name: 'test-extractor-2',
      extract: async () => {},
      getData: async () => ({}),
    };

    const extractor3: BlockExtractor = {
      name: 'test-extractor-3',
      extract: async () => {},
      getData: async () => ({}),
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
      networkState,
      processorsState: getInitialProcessorsState([extractor1, extractor2]),
    };

    await registerProcessors(services, [extractor1, extractor2]);

    expect(pick(await dumpDB(dbCtx.db), 'job')).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": null,
      "id": 1,
      "last_block_id": 0,
      "name": "test-extractor",
      "status": "processing",
    },
    Object {
      "extra_info": null,
      "id": 2,
      "last_block_id": 0,
      "name": "test-extractor-2",
      "status": "processing",
    },
  ],
}
`);

    await registerProcessors(services, [extractor2, extractor3]);

    expect(pick(await dumpDB(dbCtx.db), 'job')).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": null,
      "id": 1,
      "last_block_id": 0,
      "name": "test-extractor",
      "status": "not-ready",
    },
    Object {
      "extra_info": null,
      "id": 2,
      "last_block_id": 0,
      "name": "test-extractor-2",
      "status": "processing",
    },
    Object {
      "extra_info": null,
      "id": 3,
      "last_block_id": 0,
      "name": "test-extractor-3",
      "status": "processing",
    },
  ],
}
`);
  });

  it('should set startingBlockNumber when applicable', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    const extractor1: BlockExtractor = {
      name: 'test-extractor',
      startingBlockNumber: 3,
      extract: async () => {},
      getData: async () => ({}),
    };

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: testConfig,
      columnSets: undefined as any,
      provider: undefined as any,
      networkState,
      processorsState: getInitialProcessorsState([extractor1]),
    };

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      -- this is done to force block numbers to be different than ids
      DELETE FROM vulcan2x.block b WHERE b.number = 3;
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(4, '0x04', '2019-07-02 11:18:04+00');
    `,
    );

    await registerProcessors(services, [extractor1]);

    expect(pick(await dumpDB(dbCtx.db), 'job')).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": null,
      "id": 1,
      "last_block_id": 4,
      "name": "test-extractor",
      "status": "processing",
    },
  ],
}
`);

    await registerProcessors(services, [extractor1]);

    expect(pick(await dumpDB(dbCtx.db), 'job')).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": null,
      "id": 1,
      "last_block_id": 4,
      "name": "test-extractor",
      "status": "processing",
    },
  ],
}
`);
  });
});
