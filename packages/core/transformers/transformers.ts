import { TransactionalServices, PersistedBlock } from '../generator';
import { findConsecutiveSubsets, delay } from '../utils';
import { withConnection, DbTransactedConnection } from '../db/db';
import { BlockExtractor } from '../extractors/extractor';
import { flatten } from 'lodash';
import { getLogger } from '../utils/logger';
import { RetryableError, matchMissingForeignKeyError } from '../extractors/common';
import { Services } from '../types';

const logger = getLogger('transformers/transformers');

export interface BlockTransformer {
  name: string;
  dependencies: string[];
  transform(service: TransactionalServices, data: any[]): Promise<void>;
}

type PersistedBlockWithTransformedBlockId = PersistedBlock & {
  transformed_block_id: number;
};

export async function queueNewBlocksToTransform(
  tx: DbTransactedConnection,
  transformers: BlockTransformer[],
  blocks: PersistedBlock[],
): Promise<any> {
  return Promise.all(
    flatten(
      blocks.map(b => {
        return transformers.map(t => {
          const values = {
            block_id: b.id,
            transformer_name: t.name,
            status: 'new',
          };
          return tx.none(
            `
        INSERT INTO vulcan2x.transformed_block ( 
            block_id, transformer_name, status
       ) VALUES (
         \${block_id}, \${transformer_name}, \${status}
       ) ON CONFLICT(block_id, transformer_name) DO NOTHING;`,
            values,
          );
        });
      }),
    ),
  );
}

export async function transform(
  services: Services,
  transformers: BlockTransformer[],
  extractors: BlockExtractor[],
): Promise<void> {
  logger.debug('Spawning transformers: ', transformers.length);
  // @todo sanity check for unique transformers names

  while (transformers.length > 0) {
    // NOTE: no two extractors extract at the same
    for (const transformer of transformers) {
      await transformBlocks(
        services,
        transformer,
        extractors.filter(e => transformer.dependencies.indexOf(e.name) !== -1),
      );
    }

    await delay(1000);
  }

  logger.warn('Transforming done');
}

async function transformBlocks(
  services: Services,
  transformer: BlockTransformer,
  depExtractors: BlockExtractor[],
): Promise<void> {
  const blocks = await getNextBlocks(services, transformer);
  logger.debug(`Transforming ${blocks.length} blocks with ${transformer.name}`);

  const consecutiveBlocks = findConsecutiveSubsets(blocks, 'number');
  await Promise.all(
    consecutiveBlocks.map(async blocks => {
      logger.debug(
        `Transforming block from ${blocks[0].number} to ${blocks[0].number + blocks.length}`,
      );

      try {
        await services.db.tx(async tx => {
          const processorServices: TransactionalServices = {
            ...services,
            tx,
          };

          const data = await Promise.all(
            depExtractors.map(dep => dep.getData(processorServices, blocks)),
          );

          await transformer.transform(processorServices, data);

          logger.debug(
            `Marking blocks as processed from ${blocks[0].number} to ${blocks[0].number +
              blocks.length}`,
          );
          await markBlocksTransformed(services, tx, blocks, transformer, 'done');
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
          await withConnection(services.db, c =>
            markBlocksTransformed(services, c, blocks, transformer, 'error'),
          );
        }
      }
    }),
  );
}

async function getNextBlocks(
  services: Services,
  transformer: BlockTransformer,
): Promise<PersistedBlockWithTransformedBlockId[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    // TODO: SQL injection here
    const nextBlocks: PersistedBlockWithTransformedBlockId[] | null = await c.manyOrNone<
      PersistedBlockWithTransformedBlockId
    >(
      `
      SELECT b.*, tb.id as transformed_block_id
      FROM vulcan2x.block b
      JOIN vulcan2x.transformed_block tb ON b.id = tb.block_id 
      ${transformer.dependencies
        .map((_, i) => `JOIN vulcan2x.extracted_block eb${i} ON b.id = eb${i}.block_id`)
        .join('\n')}
      WHERE 
        tb.transformer_name='${transformer.name}' AND tb.status = 'new'
        ${transformer.dependencies
          .map((t, i) => `AND eb${i}.extractor_name='${t}' AND eb${i}.status = 'done'`)
          .join('\n')}
      ORDER BY b.number
      LIMIT \${batch};
    `,
      {
        transformerName: transformer.name,
        dependencies: transformer.dependencies,
        dependenciesLen: transformer.dependencies.length,
        batch: config.transformerWorker.batch,
      },
    );

    if (nextBlocks && nextBlocks.length > 0) {
      return nextBlocks;
    } else {
      return [];
    }
  });
}

async function markBlocksTransformed(
  { pg, columnSets }: Services,
  connection: any,
  blocks: PersistedBlockWithTransformedBlockId[],
  transformer: BlockTransformer,
  status: 'done' | 'error',
): Promise<void> {
  const updates = blocks.map(b => {
    return {
      id: b.transformed_block_id,
      transformer_name: transformer.name,
      status,
    };
  });

  let query: string;
  if (status === 'error') {
    // we don't want transition from 'done' to 'error' to ever happening that's why we need additional
    query =
      (await pg.helpers.update(updates, columnSets.transformed_block)) +
      ` WHERE v.id = t.id AND t.status = 'new'`;
  } else {
    query = (await pg.helpers.update(updates, columnSets.transformed_block)) + ' WHERE v.id = t.id';
  }

  await connection.none(query);
}
