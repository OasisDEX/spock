import { pick } from 'lodash';
import { expect } from 'chai';

import { createDB } from '../../src/db/db';
import { prepareDB, testConfig, executeSQL, dumpDB, networkState } from 'spock-test-utils';
import { Services } from '../../src/types';
import { getNextBlocks, processBlocks } from '../../src/processors/process';
import { registerProcessors } from '../../src/processors/register';
import { BlockExtractor } from '../../src/processors/types';
import { getInitialProcessorsState } from '../../src/processors/state';

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

    expect(actual).to.be.deep.eq([
      {
        hash: '0x01',
        id: 1,
        number: 1,
        timestamp: new Date('2019-07-02T11:18:01.000Z'),
      },
      {
        hash: '0x02',
        id: 2,
        number: 2,
        timestamp: new Date('2019-07-02T11:18:02.000Z'),
      },
    ]);
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

    expect(actual).to.be.deep.eq([
      {
        hash: '0x01',
        id: 1,
        number: 1,
        timestamp: new Date('2019-07-02T11:18:01.000Z'),
      },
    ]);
  });

  it('should run processors even with huge "gaps" (reorgs) in blocks', async () => {
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await executeSQL(
      dbCtx.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(id,number, hash, timestamp) VALUES(100, 3, '0x03', '2019-07-02 11:18:03+00'); -- note: id difference is more than batch
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
      config: {
        ...testConfig,
        extractorWorker: {
          batch: 3,
          reorgBuffer: 10,
        },
      },
      columnSets: undefined as any,
      provider: undefined as any,
      networkState,
      processorsState: getInitialProcessorsState([blockExtractor]),
    };

    await registerProcessors(services, [blockExtractor]);

    const actual = await getNextBlocks(services, blockExtractor);

    expect(actual).to.be.deep.eq([
      {
        hash: '0x01',
        id: 1,
        number: 1,
        timestamp: new Date('2019-07-02T11:18:01.000Z'),
      },
      {
        hash: '0x02',
        id: 2,
        number: 2,
        timestamp: new Date('2019-07-02T11:18:02.000Z'),
      },
      {
        hash: '0x03',
        id: 100,
        number: 3,
        timestamp: new Date('2019-07-02T11:18:03.000Z'),
      },
    ]);
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
    expect(dbBeforeError).to.be.deep.eq({
      job: [
        {
          extra_info: null,
          id: 1,
          last_block_id: 1,
          name: 'test-extractor',
          status: 'processing',
        },
      ],
    });

    await processBlocks(services, blockExtractor);
    const db = pick(await dumpDB(services.db), 'job');
    db.job = db.job.map((e) => ({
      ...e,
      extra_info: JSON.stringify(JSON.parse(e.extra_info).map((e: any) => pick(e, 'message'))),
    }));
    expect(db).to.be.deep.eq({
      job: [
        {
          extra_info:
            '[{"message":"Error in the middle of processing!"},{"message":"Error in the middle of processing!"}]',
          id: 1,
          last_block_id: 1,
          name: 'test-extractor',
          status: 'stopped',
        },
      ],
    });
  });
});
