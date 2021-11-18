import { withConnection } from '../db/db';
import { delay, getLast, findConsecutiveSubsets, getSpockBreakout } from '../utils';
import { getLogger } from '../utils/logger';
import { Services, TransactionalServices } from '../types';
import { get, sortBy, groupBy } from 'lodash';
import { BlockModel } from '../db/models/Block';
import { getJob, stopJob } from '../db/models/Job';
import { Processor, isExtractor, BlockExtractor } from './types';
import { getRandomProvider } from '../services';
import { clearProcessorState, addProcessorError, getProcessorErrors } from './state';
import { captureException } from '@sentry/node';

const logger = getLogger('extractor/index');

export async function process(services: Services, processors: Processor[]): Promise<void> {
  logger.debug('Spawning extractors: ', processors.length);

  while (processors.length > 0 && !getSpockBreakout()) {
    // NOTE: no two processors extract at the same
    let processed = 0;
    for (const p of processors) {
      const processedNow = await processBlocks(services, p);
      processed += processedNow;
    }

    // if we didn't process anything new introduce artificial delay before next run
    if (processed === 0) {
      await delay(1000);
    }
  }
  logger.warn('Processing done');
}

export async function processBlocks(services: Services, processor: Processor): Promise<number> {
  const blocks = await getNextBlocks(services, processor);
  if (blocks.length === 0) {
    return 0;
  }

  // We can speed up whole process (process blocks in batches) if we don't have a risk of reorg.
  // Otherwise we process blocks separately to avoid problems with reorgs while processing tip of the blockchain.
  // By setting extractorWorker.reorgBuffer = 0 you can switch off this behaviour on chains that can't reorg (POA networks).
  const closeToTheTipOfBlockchain =
    services.config.extractorWorker.reorgBuffer === 0
      ? false
      : ((get(blocks, '[0].number') as number) || 0) +
          services.config.extractorWorker.batch -
          services.networkState.latestEthereumBlockOnStart +
          services.config.extractorWorker.reorgBuffer >
        0;

  const batchProcessing =
    !closeToTheTipOfBlockchain || (processor as any).disablePerfBoost || false;
  const blocksInBatches = !batchProcessing
    ? blocks.map(b => [b])
    : findConsecutiveSubsets(blocks, 'number');
  logger.debug(
    `Processing ${blocks.length} blocks with ${processor.name}. Process in batch: ${batchProcessing}`,
  );

  try {
    for (const blocks of blocksInBatches) {
      logger.trace(`Extracting blocks: ${blocks.map(b => b.number).join(', ')}`);

      await services.db.tx(async tx => {
        const txServices: TransactionalServices = {
          ...services,
          provider: getRandomProvider(),
          tx,
        };
        if (isExtractor(processor)) {
          await processor.extract(txServices, blocks);
        } else {
          const realDeps = findExtractorDependencies(
            processor.dependencies,
            services.config.extractors,
          );
          const data = await Promise.all(realDeps.map(dep => dep.getData(txServices, blocks)));

          await processor.transform(txServices, data);
        }

        logger.debug(
          // prettier-ignore
          `Marking blocks as processed from ${blocks[0].number} to ${blocks[0].number + blocks.length} with ${processor.name}`,
        );
        await markBlocksProcessed(tx, blocks, processor);
        logger.debug(
          `Closing db transaction for ${blocks[0].number} to ${blocks[0].number + blocks.length}`,
        );
      });
    }

    clearProcessorState(services, processor);
  } catch (e) {
    logger.warn(
      // prettier-ignore
      `WARN[]: Error occured while processing: ${blocks[0].number} - ${blocks[0].number + blocks.length} with ${processor.name}`,
      e,
    );
    console.warn('WARN:', e);

    addProcessorError(services, processor, e);

    if (
      getProcessorErrors(services, processor).length >
      services.config.processorsWorker.retriesOnErrors
    ) {
      logger.error(`Stopping ${processor.name}. Restart ETL to continue`);

      const allErrors = JSON.stringify(getProcessorErrors(services, processor));
      logger.error('ERROR:', allErrors);

      captureException(e);

      await withConnection(services.db, async c => {
        await stopJob(c, processor.name, allErrors);
      });
      clearProcessorState(services, processor);
    }
  }

  return blocks.length;
}

export async function getNextBlocks(
  services: Services,
  processor: Processor,
): Promise<BlockModel[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    const batchSize = config.extractorWorker.batch;

    const job = await getJob(c, processor.name);
    if (!job) {
      throw new Error(`Missing processor: ${processor.name}`);
    }
    if (job.status !== 'processing') {
      logger.info(`Processors excluded from processing. Status is: ${job.status}`);
      return [];
    }

    const query  = `
    SELECT b.* FROM vulcan2x.block b
      WHERE id<= (SELECT MIN(last_block_id) FROM vulcan2x.job  WHERE name in(
        ${getAllDependencies(processor).map(dependency => `'${dependency}'`).join(',')}
      ) ) AND b.id > ${job.last_block_id} ORDER BY id
    LIMIT ${batchSize};`

    const nextBlocks =
      (await c.manyOrNone<BlockModel>(
        // prettier-ignore
        query
      )) || [];

    return sortBy(nextBlocks, 'id');
  });
}

async function markBlocksProcessed(
  connection: any,
  blocks: BlockModel[],
  processor: Processor,
): Promise<void> {
  const lastId = getLast(blocks)!.id;

  const updateJobSQL = `
  UPDATE vulcan2x.job
  SET last_block_id = ${lastId}
  WHERE name='${processor.name}'
  `;

  await connection.none(updateJobSQL);
}

export function getAllDependencies(p: Processor): string[] {
  if (isExtractor(p)) {
    return p.extractorDependencies || [];
  } else {
    return [...(p.dependencies || []), ...(p.transformerDependencies || [])];
  }
}

export function findExtractorDependencies(
  dependencies: string[],
  allExtractors: BlockExtractor[],
): BlockExtractor[] {
  const extractorsByName = groupBy(allExtractors, 'name');

  const result: BlockExtractor[] = [];
  for (const d of dependencies) {
    const realDep = extractorsByName[d];
    if (!realDep || !realDep[0]) {
      throw new Error(`Dependency ${realDep} couldn't be found!`);
    }

    result.push(realDep[0]);
  }

  return result;
}
