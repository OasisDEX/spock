import { DB, withConnection, createDB } from '../src/db/db';
import { getDefaultConfig, SpockConfig } from '../src/config';
import { NetworkState } from '../src/ethereum/getNetworkState';
import { Services } from '../src/types';
import { migrateFromConfig } from '../src/bin/migrateUtils';

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
    reorgBuffer: 10,
  },
  startingBlock: 0,
  processorsWorker: {
    retriesOnErrors: 1,
  },
  migrations: {},
  statsWorker: {
    enabled: false,
  },
} as any;

export async function prepareDB(db: DB, config: SpockConfig): Promise<void> {
  await withConnection(db, async c => {
    const schemasWrapped: { name: string }[] = await c.many(
      'SELECT schema_name as name FROM information_schema.schemata;',
    );
    const schemasToDelete = schemasWrapped
      .map(s => s.name)
      .filter(n => !n.startsWith('pg_') && n !== 'information_schema');

    await c.none(`
    DROP SCHEMA IF EXISTS ${schemasToDelete.join(',')} CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
    `);
  });

  await migrateFromConfig(config);
  console.log('DB prepared');
}

export const dumpDB = async (db: DB) => {
  return await withConnection(db, async c => {
    return {
      blocks: await c.manyOrNone(`SELECT * FROM vulcan2x.block`),
      transaction: await c.manyOrNone(`SELECT * FROM vulcan2x.transaction`),
      extracted_logs: await c.manyOrNone(
        `SELECT block_id, data, log_index, topics FROM extracted.logs ORDER BY block_id, log_index;`,
      ),
      job: await c.manyOrNone(`SELECT * FROM vulcan2x.job ORDER BY name;`),
    };
  });
};

export async function executeSQL(db: DB, sql: string): Promise<void> {
  await db.any(sql);
}

export async function getSQL(db: DB, sql: string): Promise<any[]> {
  return db.any(sql);
}

export const networkState: NetworkState = {
  latestEthereumBlockOnStart: 1,
  networkName: { name: 'test', chainId: 1337, ensAddress: '0x0' },
};

export async function servicesFixture(): Promise<Services> {
  const dbCtx = createDB(testConfig.db);
  await prepareDB(dbCtx.db, testConfig);

  return {
    db: dbCtx.db,
    pg: dbCtx.pg,
    config: testConfig,
    columnSets: undefined as any,
    provider: undefined as any,
    networkState,
    processorsState: {},
  };
}
