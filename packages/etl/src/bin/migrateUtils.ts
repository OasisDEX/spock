import { join } from 'path'
import { migrate as migrateDB } from 'postgres-migrations-oasis'

import { SpockConfig } from '../services/config'
import { getLogger } from '../utils/logger'

const logger = getLogger('migration')

export async function migrateFromConfig(config: SpockConfig): Promise<void> {
  await migrate(config.db, 'vulcan2x_core', join(__dirname, '../../migrate'))

  const migrationNames = Object.keys(config.migrations)

  for (const migration of migrationNames) {
    const migrationDirectory = config.migrations[migration]

    await migrate(config.db, migration, migrationDirectory)
  }
}

async function migrate(dbConfig: SpockConfig['db'], name: string, dirPath: string): Promise<void> {
  logger.info(`Migrating ${name}...`)
  try {
    await migrateDB({ ...(dbConfig as any), tableName: `migrations_${name}` }, dirPath)
    logger.info(`Migration for ${name} completed`)
  } catch (e) {
    logger.error(`Error while migrating ${name}`)
    throw e
  }
}
