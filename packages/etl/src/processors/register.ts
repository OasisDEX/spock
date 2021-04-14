import { difference } from 'lodash'

import { DbConnection, withConnection } from '../db/db'
import { getBlockByNumber } from '../db/models/Block'
import { excludeAllJobs, getJob, saveJob, setJobStatus, WritableJobModel } from '../db/models/Job'
import { Services } from '../services/types'
import { getLogger } from '../utils/logger'
import { isExtractor, Processor } from './types'

const logger = getLogger('register')

/**
 * Prepares vulcan2x.job table with all processors. Note: this should be called just once per ETL start!
 */
export async function registerProcessors(services: Services, processors: Processor[]): Promise<void> {
  validateIntegrity(processors)

  await withConnection(services.db, async (c) => {
    logger.info('De-registering all processors...')
    await excludeAllJobs(c)

    logger.info(`Registering configured processors(${processors.length})...`)
    for (const processor of processors) {
      await registerProcessor(c, processor)
    }
  })
}

async function registerProcessor(c: DbConnection, processor: Processor): Promise<void> {
  const jobModel = await getJob(c, processor.name)

  if (jobModel) {
    logger.info(
      // prettier-ignore
      `Setting processor ${processor.name} status to 'processing'. Previously: '${jobModel.status}'`,
    )
    await setJobStatus(c, jobModel, 'processing')
  } else {
    const newJob: WritableJobModel = {
      name: processor.name,
      last_block_id: await getStartingBlockId(c, processor),
      status: 'processing',
    }

    logger.info(`Registering a new processor ${processor.name}: (${JSON.stringify(newJob)})`)
    await saveJob(c, newJob)
  }
}

async function getStartingBlockId(c: DbConnection, processor: Processor): Promise<number> {
  if (processor.startingBlock === undefined) {
    return 0
  }

  const block = await getBlockByNumber(c, processor.startingBlock)
  if (block === undefined) {
    logger.warn(
      `Can't find starting block for ${processor.name}. BlockNumber: ${processor.startingBlock} is not yet synced. It will sync from the global start block`,
    )
    return 0
  }

  return block.id
}

function validateIntegrity(processors: Processor[]): void {
  checkNameUniqueness(processors)
  checkDependencies(processors)
}

function checkNameUniqueness(processors: Processor[]): void {
  const uniqueNames = new Set<string>()
  const names = processors.map((p) => p.name)

  for (const name of names) {
    if (uniqueNames.has(name)) {
      throw new Error(`${name} processor name is not unique!`)
    }
    uniqueNames.add(name)
  }
}

// ensures that all dependencies exist
function checkDependencies(processors: Processor[]): void {
  const allNames = processors.map((p) => p.name)

  for (const processor of processors) {
    if (isExtractor(processor)) {
      const diff = difference(processor.extractorDependencies || [], allNames)
      if (diff.length > 0) {
        throw new Error(
          `Processor ${processor.name} has extractorDependencies that couldn't be find: ${diff.join(', ')}`,
        )
      }
    } else {
      const diff = difference(processor.dependencies || [], allNames)
      if (diff.length > 0) {
        throw new Error(`Processor ${processor.name} has dependencies that couldn't be find: ${diff.join(', ')}`)
      }
      const diff2 = difference(processor.transformerDependencies || [], allNames)
      if (diff2.length > 0) {
        throw new Error(
          `Processor ${processor.name} has transformerDependencies that couldn't be find: ${diff2.join(', ')}`,
        )
      }
    }
  }
}
