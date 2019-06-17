import { migrate } from 'postgres-migrations-oasis';

import { DB, withConnection } from '../core/db/db';
import { getDefaultConfig, SpockConfig } from '../core/config';

export const testConfig: SpockConfig = {
  ...getDefaultConfig({
    VL_DB_DATABASE: 'database',
    VL_DB_USER: 'user',
    VL_DB_PASSWORD: 'password',
    VL_DB_HOST: 'localhost',
    VL_DB_PORT: '5432',
    VL_CHAIN_HOST: '',
    VL_CHAIN_NAME: '',
  }),
  blockGenerator: {
    batch: 2,
  },
  extractorWorker: {
    batch: 2,
  },
  startingBlock: 0,
} as any;

export async function prepareDB(db: DB, config: SpockConfig): Promise<void> {
  await withConnection(db, async c => {
    await c.none(`
    DROP SCHEMA IF EXISTS public, api, rest_api, dschief, oasis, oasis_market, vulcan2x, extracted, erc20, proxy CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
    `);
  });

  await migrate(config.db, 'migrate', undefined as any);
  console.log('DB prepared');
}

export async function dumpDB(db: DB): Promise<any> {
  return await withConnection(db, async c => {
    return {
      blocks: await c.manyOrNone(`SELECT * FROM vulcan2x.block`),
      extracted_blocks: await c.manyOrNone(
        `SELECT block_id, extractor_name, status FROM vulcan2x.extracted_block ORDER BY block_id`,
      ),
      transaction: await c.manyOrNone(`SELECT * FROM vulcan2x.transaction`),
    };
  });
}
