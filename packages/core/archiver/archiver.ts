import { Services, TransactionalServices } from '../types';
import { findConsecutiveSubsets, getLast, delay } from '../utils';
import {
  saveDoneExtractedBlock,
  updateDoneExtractedBlock,
  DoneExtractedBlock,
} from '../db/models/DoneExtractedBlock';
import { ExtractedBlock } from '../db/models/ExtractedBlock';
import { getLogger } from '../utils/logger';
import { getBlockRange } from '../db/models/Block';
import { withTx } from '../services';

const logger = getLogger('archiver');

export async function archiver(_services: Services): Promise<void> {
  while (true) {
    await archiveOnce(_services);

    await delay(_services.config.archiverWorker.delay * 1000 * 60);
  }
}

export async function archiveOnce(_services: Services): Promise<void> {
  for (const extractor of _services.config.extractors) {
    let done = false;
    while (!done) {
      logger.info(`Archiving ${extractor.name}`);

      await withTx(_services, async services => {
        const processed = await archiveExtractor(services, extractor.name);

        done = processed < services.config.archiverWorker.batch;
      });
    }

    await withTx(_services, async services => {
      await mergeRanges(services, extractor.name);
    });
  }
}

export async function archiveExtractor(
  services: TransactionalServices,
  extractorName: string,
): Promise<number> {
  const sql = `
  SELECT * FROM vulcan2x.extracted_block eb 
  WHERE eb.extractor_name='${extractorName}' AND status='done' 
  ORDER BY eb.block_id LIMIT ${services.config.archiverWorker.batch};
  `;

  const blocksToAchieve = (await services.tx.manyOrNone<ExtractedBlock>(sql)) || [];
  logger.info({ toArchive: blocksToAchieve.length, extractorName });
  const consecutiveBlocks = findConsecutiveSubsets(blocksToAchieve, 'block_id');

  for (const consecutiveBlock of consecutiveBlocks) {
    logger.log('Subset ', JSON.stringify(consecutiveBlock));
    const first = consecutiveBlock[0];
    const last = getLast(consecutiveBlock)!;

    logger.log(`Creating new range <${first.block_id}, ${last.block_id}>`);

    await saveDoneExtractedBlock(services, {
      start_block_id: first.block_id,
      end_block_id: last.block_id,
      extractor_name: extractorName,
    });

    await deleteRangeExtractedBlock(services, first.block_id, last.block_id, extractorName);
  }

  return blocksToAchieve.length;
}

export async function mergeRanges(
  services: TransactionalServices,
  extractorName: string,
): Promise<void> {
  const [firstRange, ...ranges] = await selectDoneExtractedBlocks(services, extractorName);

  const rangesToDrop: DoneExtractedBlock[] = [];
  let lastRange = firstRange;
  for (const range of ranges) {
    const existingBlocks = await getBlockRange(
      services,
      lastRange.end_block_id + 1,
      lastRange.start_block_id - 1,
    );

    const areThereAnyBlocksBetween = existingBlocks.length !== 0;

    if (areThereAnyBlocksBetween) {
      lastRange = range;
      // we can't merge, there are some blocks not extracted, archived or errored
      continue;
    }

    logger.log(
      `Merging range ${lastRange.id} — <${lastRange.start_block_id}, ${range.end_block_id}> with ${
        existingBlocks.length
      } gap`,
    );

    await updateDoneExtractedBlock(services, lastRange.id, {
      end_block_id: range.end_block_id,
    });
    rangesToDrop.push(range);
  }

  logger.log('Deleting not needed ranges.');
  await deleteRanges(services, rangesToDrop.map(r => r.id));
}

export async function deleteRangeExtractedBlock(
  services: TransactionalServices,
  fromId: number,
  toId: number,
  extractorName: string,
): Promise<void> {
  const sql = `DELETE FROM vulcan2x.extracted_block WHERE block_id >= ${fromId} AND block_id <= ${toId} AND extractor_name='${extractorName}';`;

  await services.tx.none(sql);
}

export async function selectDoneExtractedBlocks(
  services: TransactionalServices,
  extractorName: string,
): Promise<DoneExtractedBlock[]> {
  const sql = `
  SELECT * FROM vulcan2x.done_extracted_block deb 
  WHERE deb.extractor_name='${extractorName}'
  ORDER BY deb.start_block_id;`;

  return await services.tx.manyOrNone<DoneExtractedBlock>(sql);
}

export async function deleteRanges(services: TransactionalServices, ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const sql = `
DELETE FROM vulcan2x.done_extracted_block
WHERE id IN (${ids.join(',')});
  `;
  await services.tx.none(sql);
}
