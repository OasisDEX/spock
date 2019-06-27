import { addTx, matchMissingForeignKeyError, matchUniqueKeyError } from './common';
import { createDB, withConnection } from '../db/db';
import { prepareDB, testConfig } from '../../test/common';
import { ethers } from 'ethers';
import { PersistedBlock, TransactionalServices } from '../types';

describe('extractors/common matchMissingForeignKeyError', () => {
  it('should work', async () => {
    expect.assertions(1);

    const transaction: Partial<ethers.utils.Transaction> = {
      hash: 'hash',
      to: 'to',
      from: 'from',
      data: '0x',
      value: 1 as any,
      gasLimit: 1 as any,
      gasPrice: 1 as any,
    };
    const block: Partial<PersistedBlock> = {
      id: 1,
    };

    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await dbCtx.db.tx(async tx => {
      const services: TransactionalServices = {
        tx,
        columnSets: undefined as any,
        pg: dbCtx.pg,
        config: testConfig,
        provider: undefined as any,
      };

      try {
        await addTx(services, transaction as any, block as any);
      } catch (e) {
        expect(matchMissingForeignKeyError(e)).toBeTruthy();
      }
    });
  });
});

describe('extractors/common matchUniqueKeyError', () => {
  it('should work', async () => {
    expect.assertions(1);
    const dbCtx = createDB(testConfig.db);
    await prepareDB(dbCtx.db, testConfig);

    await withConnection(dbCtx.db, async c => {
      try {
        await c.none(`INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, 'abc', now())`);
        await c.none(`INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, 'abc', now())`);
      } catch (e) {
        expect(matchUniqueKeyError(e)).toBeTruthy();
      }
    });
  });
});
