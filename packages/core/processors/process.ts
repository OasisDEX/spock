import { withConnection } from '../db/db';
import { delay, getLast, findConsecutiveSubsets } from '../utils';
import { getLogger } from '../utils/logger';
import { Services, TransactionalServices } from '../types';
import { get, sortBy } from 'lodash';
import { BlockModel } from '../db/models/Block';
import { getJob } from '../db/models/Job';
import { matchMissingForeignKeyError, RetryableError } from './extractors/common';
import { Processor, isExtractor } from './types';

const logger = getLogger('extractor/index');

export async function process(services: Services, processors: Processor[]): Promise<void> {
  logger.debug('Spawning extractors: ', processors.length);

  while (processors.length > 0) {
    // NOTE: no two processors extract at the same
    for (const p of processors) {
      await processBlocks(services, p);
    }

    await delay(1000);
  }
  logger.warn('Processing done');
}

async function processBlocks(services: Services, processor: Processor): Promise<void> {
  const blocks = await getNextBlocks(services, processor);
  if (blocks.length === 0) {
    return;
  }

  // We can speed up whole process (process blocks in batches) if we don't have a risk of reorg.
  // Otherwise we process blocks separately to avoid problems with reorgs while processing tip of the blockchain.
  const closeToTheTipOfBlockchain =
    ((get(blocks, '[0].number') as number) || 0) +
      services.config.extractorWorker.batch -
      services.networkState.latestEthereumBlockOnStart +
      1000 >
    0;

  const batchProcessing =
    !closeToTheTipOfBlockchain || (processor as any).disablePerfBoost || false;
  const blocksInBatches = !batchProcessing
    ? blocks.map(b => [b])
    : findConsecutiveSubsets(blocks, 'number');
  logger.debug(
    `Processing ${blocks.length} blocks with ${
      processor.name
    }. Process in batch: ${batchProcessing}`,
  );

  for (const blocks of blocksInBatches) {
    logger.debug(`Extracting blocks: ${blocks.map(b => b.number).join(', ')}`);

    try {
      await services.db.tx(async tx => {
        const txServices: TransactionalServices = {
          ...services,
          tx,
        };
        if (isExtractor(processor)) {
          await processor.extract(txServices, blocks);
        } else {
          await processor.transform(txServices, blocks);
        }

        logger.debug(
          `Marking blocks as processed from ${blocks[0].number} to ${blocks[0].number +
            blocks.length}`,
        );
        await markBlocksProcessed(tx, blocks, processor);
        logger.debug(
          `Closing db transaction for ${blocks[0].number} to ${blocks[0].number + blocks.length}`,
        );
      });
    } catch (e) {
      logger.error(
        `ERROR[]: Error occured while processing: ${blocks[0].number} - ${blocks[0].number +
          blocks.length}`,
        e,
      );
      //there is a class of error that we want to retry so we don't mark the blocks as processed
      if (e instanceof RetryableError || matchMissingForeignKeyError(e)) {
        logger.debug(
          `Retrying processing for ${blocks[0].number} - ${blocks[0].number + blocks.length}`,
        );
      } else {
        // MARK IT AS ERRORED!!!
        console.log('CATASTROFIC ERROR: ', e);
        global.process.exit(1);
      }
    }
  }
}

export async function getNextBlocks(
  services: Services,
  processor: Processor,
): Promise<BlockModel[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    const batchSize = config.extractorWorker.batch;

    const lastProcessed = await getJob(c, processor.name);
    if (!lastProcessed) {
      throw new Error(`Missing processor: ${processor.name}`);
    }

    // note that dependencies could be also done in memory but doing this in one concurrent environment
    // todo: maybe rewrite it
    const nextBlocks =
      (await c.manyOrNone<BlockModel>(
        // prettier-ignore
        `
        SELECT b.* 
        FROM vulcan2x.block b 
        ${getAllDependencies(processor)
          .map((d, i) => `JOIN vulcan2x.job j${i} ON j${i}.name='${d}' AND b.id <= j${i}.last_block_id`)
          .join('\n')}
        WHERE 
          b.id > ${lastProcessed.last_block_id} AND 
          b.id <= ${lastProcessed.last_block_id + batchSize};
      `,
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
