import { loadConfig } from '../services/configUtils'
import { migrateFromConfig } from './migrateUtils'
import { runAndHandleErrors } from './utils'

export async function main(): Promise<void> {
  const configPath = process.argv[2]
  if (!configPath) {
    throw new Error('You need to provide config as a first argument!')
  }

  const config = loadConfig(configPath)

  await migrateFromConfig(config)
}

runAndHandleErrors(main)
