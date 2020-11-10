import { startETL } from '@oasisdex/spock-etl/dist/etl'
import { getDefaultConfig, UserProvidedSpockConfig } from '@oasisdex/spock-etl/dist/services/config'
import { Services } from '@oasisdex/spock-etl/dist/services/types'
import { setSpockBreakout } from '@oasisdex/spock-etl/dist/utils/breakout'
import { delay } from '@oasisdex/spock-etl/dist/utils/promises'
import { merge } from 'lodash'

import { dumpDB, prepareDB } from './db'
import { createTestServices } from './services'

export async function runIntegrationTest(externalConfig: UserProvidedSpockConfig): Promise<Services> {
  const config = merge({}, getDefaultConfig(process.env), { ...externalConfig, statsWorker: { enabled: false } }) as any
  const services = await createTestServices({
    config,
  })

  await prepareDB(services.db, config)

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
      throw new Error(`Failed jobs detected ${JSON.stringify(erroredJobs)}`)
    }
  }
  setSpockBreakout()

  await etl
}
