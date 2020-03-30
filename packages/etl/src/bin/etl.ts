import { etl } from '../etl'
import { loadConfig } from '../services/configUtils'
import { runAndHandleErrors } from './utils'

export async function main(): Promise<void> {
  const config = loadConfig()

  await etl(config)
}

runAndHandleErrors(main)
