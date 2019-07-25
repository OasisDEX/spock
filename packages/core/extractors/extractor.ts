import { withConnection } from '../db/db';
import { delay, getLast, findConsecutiveSubsets } from '../utils';
import { matchMissingForeignKeyError, RetryableError } from './common';
import { getLogger } from '../utils/logger';
import { Services, TransactionalServices, LocalServices } from '../types';
import { get, sortBy } from 'lodash';
import { BlockModel } from '../db/models/Block';
import { getJob } from '../db/models/Job';

const logger = getLogger('extractor/index');

export interface BlockExtractor {
  name: string;
  extractorDependencies?: string[];
  disablePerfBoost?: boolean;

  // @note: blocks are always consecutive
  // get data from node to database
  extract: (services: TransactionalServices, blocks: BlockModel[]) => Promise<void>;

  // get data from database
  getData(services: LocalServices, blocks: BlockModel[]): Promise<any>;
}

export async function extract(services: Services, extractors: BlockExtractor[]): Promise<void> {
  logger.debug('Spawning extractors: ', extractors.length);

  while (extractors.length > 0) {
    // NOTE: no two extractors extract at the same
    for (const extractor of extractors) {
      await extractBlocks(services, extractor);
    }

    await delay(1000);
  }
  logger.warn('Extracting done');
}

async function extractBlocks(services: Services, extractor: BlockExtractor): Promise<void> {
  const blocks = await getNextBlocks(services, extractor);
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

  const batchProcessing = !closeToTheTipOfBlockchain || extractor.disablePerfBoost || false;
  const blocksInBatches = !batchProcessing
    ? blocks.map(b => [b])
    : findConsecutiveSubsets(blocks, 'number');
  logger.debug(
    `Processing ${blocks.length} blocks with ${
      extractor.name
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
        await extractor.extract(txServices, blocks);

        logger.debug(
          `Marking blocks as processed from ${blocks[0].number} to ${blocks[0].number +
            blocks.length}`,
        );
        await markBlocksProcessed(tx, blocks, extractor);
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
        process.exit(1);
      }
    }
  }
}

export async function getNextBlocks(
  services: Services,
  extractor: BlockExtractor,
): Promise<BlockModel[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    const batchSize = config.extractorWorker.batch;

    const lastProcessed = await getJob(c, extractor.name);
    if (!lastProcessed) {
      throw new Error(`Missing processor: ${extractor.name}`);
    }

    const nextBlocks =
      (await c.manyOrNone<BlockModel>(
        `
        SELECT b.* 
        FROM vulcan2x.block b 
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
  processor: BlockExtractor,
): Promise<void> {
  const lastId = getLast(blocks)!.id;

  const updateJobSQL = `
  UPDATE vulcan2x.job
  SET last_block_id = ${lastId}
  WHERE name='${processor.name}'
  `;

  await connection.none(updateJobSQL);
}
