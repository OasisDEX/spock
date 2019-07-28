import { migrate as migrateDB } from 'postgres-migrations-oasis';
import { loadConfig } from '../utils/configUtils';
import { join } from 'path';
import { SpockConfig } from '../config';
import { getLogger } from '../utils/logger';

const logger = getLogger('migration');

export async function main(): Promise<void> {
  const config = loadConfig();

  await migrate(config.db, 'vulcan2x_core', join(__dirname, '../../../migrate'));

  const migrationNames = Object.keys(config.migrations);

  for (const migration of migrationNames) {
    const migrationDirectory = config.migrations[migration];

    await migrate(config.db, migration, migrationDirectory);
  }
}

main().catch(e => {
  logger.error(e);
  console.error(e);
  process.exit(1);
});

async function migrate(dbConfig: SpockConfig['db'], name: string, dirPath: string): Promise<void> {
  logger.info(`Migrating ${name}...`);
  try {
    await migrateDB({ ...dbConfig, tableName: `migrations_${name}` }, dirPath);
    logger.info(`Migration for ${name} completed`);
  } catch (e) {
    logger.error(`Error while migrating ${name}`);
    throw e;
  }
}
