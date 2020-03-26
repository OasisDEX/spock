import { DB, withConnection, createDB } from 'spock-etl/dist/db/db';
import { getDefaultConfig, SpockConfig } from 'spock-etl/dist/config';
import { migrateFromConfig } from 'spock-etl/dist/bin/migrateUtils';

export async function prepareDB(db: DB, config: SpockConfig): Promise<void> {
  await withConnection(db, async (c) => {
    const schemasWrapped: { name: string }[] = await c.many(
      'SELECT schema_name as name FROM information_schema.schemata;',
    );
    const schemasToDelete = schemasWrapped
      .map((s) => s.name)
      .filter((n) => !n.startsWith('pg_') && n !== 'information_schema');

    await c.none(`
    DROP SCHEMA IF EXISTS ${schemasToDelete.join(',')} CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
    `);
  });

  await migrateFromConfig(config);
  console.log('DB prepared');
}

export async function dumpDB(db: DB) {
  return await withConnection(db, async (c) => {
    return {
      blocks: await c.manyOrNone(`SELECT * FROM vulcan2x.block`),
      transaction: await c.manyOrNone(`SELECT * FROM vulcan2x.transaction`),
      extracted_logs: await c.manyOrNone(
        `SELECT block_id, data, log_index, topics FROM extracted.logs ORDER BY block_id, log_index;`,
      ),
      job: await c.manyOrNone(`SELECT * FROM vulcan2x.job ORDER BY name;`),
    };
  });
}

export async function executeSQL(db: DB, sql: string): Promise<void> {
  await db.any(sql);
}

export async function getSQL(db: DB, sql: string): Promise<any[]> {
  return db.any(sql);
}
