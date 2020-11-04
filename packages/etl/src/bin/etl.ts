import { etl } from '../etl'
import { loadConfig } from '../services/configUtils'
import { runAndHandleErrors } from './utils'

export async function main(): Promise<void> {
  const configPath = process.argv[2]
  if (!configPath) {
    throw new Error('You need to provide config as a first argument!')
  }

  const config = loadConfig(configPath)

  await etl(config)
}

runAndHandleErrors(main)
