import { UserProvidedSpockConfig } from '@spock/etl/dist/services/config'
import { mergeConfig } from '@spock/etl/dist/services/configUtils'
import { startETL } from '@spock/etl/dist/etl'
import { delay } from '@spock/etl/dist/utils/promises'
import { setSpockBreakout } from '@spock/etl/dist/utils/breakout'

import { createTestServices } from './services'
import { dumpDB } from './db'
import { Services } from '@spock/etl/dist/services/types'

export async function runIntegrationTest(externalConfig: UserProvidedSpockConfig): Promise<Services> {
  const services = await createTestServices({
    config: mergeConfig({ ...externalConfig, statsWorker: { enabled: false } }),
  })

  const etlPromise = startETL(services)

  etlPromise.catch((e) => {
    console.error('ETL FAILED WITH', e)
    process.exit(1)
  })
  await waitForAllJobs(services, etlPromise)

  return services
}

export async function waitForAllJobs(services: Services, etl: Promise<void>) {
  const { config } = services
  const allJobs = config.extractors.length + config.transformers.length
  const lastBlockId = config.lastBlock! - config.startingBlock // ids are starting from 1
  let fullySynced = false
  while (!fullySynced) {
    await delay(1000)
    const jobs = (await dumpDB(services.db)).job
    fullySynced = jobs.filter((p) => p.last_block_id >= lastBlockId).length === allJobs
    const erroredJobs = jobs.filter((p) => p.status === 'stopped')
    if (erroredJobs.length > 0) {
      throw new Error(`Failed jobs detected ${erroredJobs}`)
    }
  }
  setSpockBreakout()

  await etl
}
