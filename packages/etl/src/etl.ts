import * as ethers from 'ethers'
import { getLogger } from './utils/logger'
import { withLock } from './db/locks'
import { SpockConfig, getAllProcessors } from './services/config'
import { createServices } from './services/services'
import { blockGenerator } from './blockGenerator/blockGenerator'
import { process } from './processors/process'
import { registerProcessors } from './processors/register'
import { statsWorker } from './stats/stats'
import { printSystemInfo } from './utils/printSystemInfo'
import { Services } from './services/types'

ethers.errors.setLogLevel('error')
const logger = getLogger('runner')

export async function etl(config: SpockConfig): Promise<void> {
  const services = await createServices(config)

  printSystemInfo(config)

  return startETL(services)
}

export async function startETL(services: Services): Promise<void> {
  await withLock(services.db, services.config.processDbLock, async () => {
    if (services.config.onStart) {
      logger.debug('Running onStart hook.')
      await services.config.onStart(services)
    }

    await registerProcessors(services, getAllProcessors(services.config))

    await Promise.all([
      blockGenerator(services, services.config.startingBlock, services.config.lastBlock),
      process(services, services.config.extractors),
      process(services, services.config.transformers),
      services.config.statsWorker.enabled ? statsWorker(services) : Promise.resolve(),
    ])
  })
}
