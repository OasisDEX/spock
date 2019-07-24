import { findConsecutiveSubsets, delay } from '../utils';
import { withConnection, DbTransactedConnection } from '../db/db';
import { BlockExtractor } from '../extractors/extractor';
import { getLogger } from '../utils/logger';
import { RetryableError, matchMissingForeignKeyError } from '../extractors/common';
import { Services, LocalServices } from '../types';
import { PersistedBlock } from '../db/models/Block';

const logger = getLogger('transformers/transformers');

export interface BlockTransformer {
  name: string;
  dependencies: string[];
  transformerDependencies?: string[];
  transform(service: LocalServices, data: any[]): Promise<void>;
}

type PersistedBlockWithTransformedBlockId = PersistedBlock & {
  transformed_block_id: number;
};

export async function queueNewBlocksToTransform(
  tx: DbTransactedConnection,
  transformers: BlockTransformer[],
  blocks: PersistedBlock[],
): Promise<any> {
  const sql = `
  INSERT INTO vulcan2x.transformed_block ( 
    block_id, transformer_name, status
    ) VALUES 
  ${blocks.map(b => transformers.map(t => `(${b.id}, '${t.name}', 'new') `)).join(',')}

ON CONFLICT(block_id, transformer_name) DO NOTHING;
  `;

  return tx.none(sql);
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
  if (blocks.length === 0) {
    return;
  }
  logger.debug(`Transforming ${blocks.length} blocks with ${transformer.name}`);

  const consecutiveBlocks = findConsecutiveSubsets(blocks, 'number');
  await Promise.all(
    consecutiveBlocks.map(async blocks => {
      logger.debug(
        `Transforming block from ${blocks[0].number} to ${blocks[0].number + blocks.length}`,
      );

      try {
        await services.db.tx(async tx => {
          const processorServices: LocalServices = {
            columnSets: services.columnSets,
            config: services.config,
            pg: services.pg,
            tx,
            networkState: {
              latestEthereumBlockOnStart: 0,
            },
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

export async function getNextBlocks(
  services: Services,
  transformer: BlockTransformer,
): Promise<PersistedBlockWithTransformedBlockId[]> {
  const { db, config } = services;

  return withConnection(db, async c => {
    const nextBlocks: PersistedBlockWithTransformedBlockId[] | null = await c.manyOrNone<
      PersistedBlockWithTransformedBlockId
    >(
      // this is the most complicated query in the whole base i think. But really it's not that complicated:
      // - take all extractor dependencies and check if they are part of extracted_block table with status done or they were archived already and are part of done_job table
      // - do the same for transformer dependencies
      // prettier-ignore
      `
      SELECT b.*, tb.id as transformed_block_id
      FROM vulcan2x.block b
      JOIN vulcan2x.transformed_block tb ON b.id = tb.block_id 
      ${transformer.dependencies
        .map((t, i) => `LEFT JOIN vulcan2x.extracted_block eb${i} ON b.id = eb${i}.block_id AND eb${i}.extractor_name='${t}' AND eb${i}.status = 'done'`)
        .join('\n')}
      ${transformer.dependencies
          .map((t, i) => `LEFT JOIN vulcan2x.done_job dj${i} ON b.id >= dj${i}.start_block_id AND b.id <= dj${i}.end_block_id AND dj${i}.name='${t}'`)
          .join('\n')}
      ${(transformer.transformerDependencies || [])
        .map((t, i) => `JOIN vulcan2x.transformed_block tb${i} ON b.id = tb${i}.block_id AND tb${i}.transformer_name='${t}' AND tb${i}.status = 'done'`)
        .join('\n')}
        ${(transformer.transformerDependencies || [])
          .map((t, i) => `LEFT JOIN vulcan2x.done_job djt${i} ON b.id >= djt${i}.start_block_id AND b.id <= djt${i}.end_block_id AND djt${i}.name='${t}'`)
          .join('\n')}
      WHERE 
        tb.transformer_name='${transformer.name}' AND tb.status = 'new' AND
        ${transformer.dependencies
          .map((_, i) => `( eb${i}.extractor_name IS NOT NULL or dj${i}.name IS NOT NULL )`)
          .join('AND\n')}
        ${transformer.transformerDependencies ? " AND " : ""}
        ${(transformer.transformerDependencies || [])
          .map((_, i) => `( tb${i}.transformer_name IS NOT NULL or djt${i}.name IS NOT NULL )`)
          .join('AND\n')}
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
