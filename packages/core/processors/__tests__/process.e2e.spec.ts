import { createDB } from '../../db/db';
import { prepareDB, testConfig, executeSQL, dumpDB, networkState } from '../../../test/common';
import { Services } from '../../types';
import { getNextBlocks, processBlocks } from '../process';
import { registerProcessors } from '../register';
import { BlockExtractor } from '../types';
import { pick } from 'lodash';
import { getInitialProcessorsState } from '../state';

describe('process > getNextBlocks', () => {
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
      networkState,
      processorsState: getInitialProcessorsState([blockExtractor]),
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
      networkState,
      processorsState: getInitialProcessorsState([blockExtractor]),
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

describe('process', () => {
  it('should work when extractors throws errors', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
    `,
    );

    const blockExtractor: BlockExtractor = {
      name: 'test-extractor',
      extract: async (_s, [b]) => {
        if (b.number === 2) {
          throw new Error('Error in the middle of processing!');
        }
      },
      getData: async () => ({}),
    };

    const dummyProvider = {} as any;

    const services: Services = {
      db: dbCtx.db,
      pg: dbCtx.pg,
      config: {
        ...testConfig,
        extractorWorker: {
          batch: 4,
          reorgBuffer: 10,
        },
      },
      columnSets: undefined as any,
      provider: dummyProvider,
      networkState,
      processorsState: getInitialProcessorsState([blockExtractor]),
    };

    await registerProcessors(services, [blockExtractor]);

    await processBlocks(services, blockExtractor);
    const dbBeforeError = pick(await dumpDB(services.db), 'job');
    expect(dbBeforeError).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": "",
      "id": 1,
      "last_block_id": 1,
      "name": "test-extractor",
      "status": "stopped",
    },
  ],
}
`);

    await processBlocks(services, blockExtractor);
    const db = pick(await dumpDB(services.db), 'job');
    db.job = db.job.map(e => ({
      ...e,
      extra_info: JSON.stringify(JSON.parse(e.extra_info).map((e: any) => pick(e, 'message'))),
    }));
    expect(db).toMatchInlineSnapshot(`
Object {
  "job": Array [
    Object {
      "extra_info": "[{\\"message\\":\\"Error in the middle of processing!\\"},{\\"message\\":\\"Error in the middle of processing!\\"}]",
      "id": 1,
      "last_block_id": 1,
      "name": "test-extractor",
      "status": "stopped",
    },
  ],
}
`);
  });
});
