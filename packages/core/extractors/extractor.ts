import { Services, PersistedBlock, TransactionalServices } from '../generator';
import { withConnection, DbTransactedConnection } from '../db/db';
import { findConsecutiveSubsets, delay } from '../utils';
import { matchMissingForeignKeyError, RetryableError } from './common';
import { flatten } from 'lodash';
import { getLogger } from '../utils/logger';

const logger = getLogger('extractor/index');

export interface BlockExtractor {
  name: string;
  // @note: blocks are always consecutive
  // get data from node to database
  extract: (services: TransactionalServices, blocks: PersistedBlock[]) => Promise<void>;

  // get data from database
  getData(services: TransactionalServices, blocks: PersistedBlock[]): Promise<any>;
}

type PersistedBlockWithExtractedBlockId = PersistedBlock & {
  extracted_block_id: number;
};

export async function queueNewBlocksToExtract(
  tx: DbTransactedConnection,
  extractors: BlockExtractor[],
  blocks: PersistedBlock[],
): Promise<any> {
  return Promise.all(
    flatten(
      blocks.map(b => {
        return extractors.map(e => {
          const values = {
            block_id: b.id,
            extractor_name: e.name,
            status: 'new',
          };
          return tx.none(
            `
        INSERT INTO vulcan2x.extracted_block (
            block_id, extractor_name, status
       ) VALUES (
         \${block_id}, \${extractor_name}, \${status}
       ) ON CONFLICT(block_id, extractor_name) DO NOTHING;`,
            values,
          );
        });
      }),
    ),
  );
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
  const blocks = await getNextBlocks(services, extractor.name);

  // If whole batch was filled (we process old blocks) we try to speed up sync process by processing events together.
  // Otherwise we process blocks separately to avoid problems with reorgs while processing tip of the blockchain.
  const needsPerfBoost = blocks.length === services.config.extractorWorker.batch;
  let consecutiveBlocks: PersistedBlockWithExtractedBlockId[][];
  if (needsPerfBoost) {
    consecutiveBlocks = findConsecutiveSubsets(blocks, 'number');
  } else {
    consecutiveBlocks = blocks.map(b => [b]);
  }

  logger.debug(
    `Processing ${blocks.length} blocks with ${extractor.name}. Perf boost: ${needsPerfBoost}`,
  );

  await Promise.all(
    consecutiveBlocks.map(async blocks => {
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
          await markBlocksExtracted(services, tx, blocks, extractor, 'done');
          logger.debug(
            `Closing db transaction for ${blocks[0].number} to ${blocks[0].number + blocks.length}`,
          );
        });
      } catch (e) {
        logger.error(
          `Error occured while processing: ${blocks[0].number} - ${blocks[0].number +
            blocks.length}`,
          e,
        );
        //there is a class of error that we want to retry so we don't mark the blocks as processed
        if (e instanceof RetryableError || matchMissingForeignKeyError(e)) {
          logger.debug(
            `Retrying processing for ${blocks[0].number} - ${blocks[0].number + blocks.length}`,
          );
        } else {
          // @todo error handling could be (perhaps) simpler here
          try {
            await withConnection(services.db, c =>
              markBlocksExtracted(services, c, blocks, extractor, 'error'),
            );
          } catch (e) {
            // @todo match name of the foreign key as well
            // + logging
            if (!matchMissingForeignKeyError(e)) {
              throw e;
            }
          }
        }
      }
    }),
  );
}

async function getNextBlocks(
  services: Services,
  processorName: string,
): Promise<PersistedBlockWithExtractedBlockId[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    while (true) {
      const nextBlocks: PersistedBlockWithExtractedBlockId[] | null = await c.manyOrNone<
        PersistedBlockWithExtractedBlockId
      >(
        `
      SELECT b.*, eb.id as extracted_block_id
      FROM vulcan2x.block b
      JOIN vulcan2x.extracted_block eb ON b.id=eb.block_id 
      WHERE eb.extractor_name=\${processorName} AND eb.status = 'new'
      ORDER BY b.number
      LIMIT \${batch};
      `,
        { processorName, batch: config.extractorWorker.batch },
      );

      if (nextBlocks && nextBlocks.length > 0) {
        return nextBlocks;
      } else {
        return [];
      }
    }
  });
}

async function markBlocksExtracted(
  { pg, columnSets }: Services,
  connection: any,
  blocks: PersistedBlockWithExtractedBlockId[],
  extractor: BlockExtractor,
  status: 'done' | 'error',
): Promise<void> {
  const updates = blocks.map(b => {
    return {
      id: b.extracted_block_id,
      extractor: extractor.name,
      status,
    };
  });

  let query: string;
  if (status === 'error') {
    // we don't want transition from 'done' to 'error' to ever happening that's why we need additional
    query =
      (await pg.helpers.update(updates, columnSets.extracted_block)) +
      ` WHERE v.id = t.id AND t.status = 'new'`;
  } else {
    query = (await pg.helpers.update(updates, columnSets.extracted_block)) + ' WHERE v.id = t.id';
  }

  await connection.none(query);
}
