import { Services, TransactionalServices } from '../types';
import { findConsecutiveSubsets, getLast, delay } from '../utils';
import {
  saveDoneExtractedBlock,
  updateDoneExtractedBlock,
  DoneExtractedBlock,
} from '../db/models/DoneExtractedBlock';
import { ExtractedBlock } from '../db/models/ExtractedBlock';
import { getLogger } from '../utils/logger';
import { makeNullUndefined } from '../db/db';
import { getBlockById } from '../extractors/common';

const logger = getLogger('archiver');

export async function archiver(_services: Services): Promise<void> {
  while (true) {
    for (const extractor of _services.config.extractors) {
      let done = false;
      while (!done) {
        logger.info(`Archiving ${extractor.name}`);

        await _services.db.tx(async tx => {
          const services: TransactionalServices = {
            ..._services,
            tx,
          };

          const processed = await archiveExtractor(services, extractor.name);
          done = processed < services.config.archiverWorker.batch;
        });
      }
    }

    await delay(_services.config.archiverWorker.delay * 1000 * 60);
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

    const rangeAlreadyExisting = await selectPreviousMergableDoneExtractedBlock(
      services,
      first.extractor_name,
      first.block_id,
    );

    if (!!rangeAlreadyExisting) {
      logger.log(
        `Updating range ${rangeAlreadyExisting.id} — <${rangeAlreadyExisting.start_block_id}, ${
          rangeAlreadyExisting.end_block_id
        }>`,
      );

      await updateDoneExtractedBlock(services, rangeAlreadyExisting.id, {
        end_block_id: last.block_id,
      });
    } else {
      logger.log(`Creating new range <${first.block_id}, ${last.block_id}>`);

      await saveDoneExtractedBlock(services, {
        start_block_id: first.block_id,
        end_block_id: last.block_id,
        extractor_name: extractorName,
      });
    }

    await deleteRangeExtractedBlock(services, first.block_id, last.block_id, extractorName);
  }

  return blocksToAchieve.length;
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

export async function selectPreviousMergableDoneExtractedBlock(
  services: TransactionalServices,
  extractorName: string,
  nextBlockId: number,
): Promise<DoneExtractedBlock | undefined> {
  const selectLastDoneExtractedBlockSQL = `
  SELECT * FROM vulcan2x.done_extracted_block deb 
  WHERE deb.extractor_name='${extractorName}'
  ORDER BY id DESC LIMIT 1;`;

  const lastRange = await services.tx
    .oneOrNone<DoneExtractedBlock>(selectLastDoneExtractedBlockSQL)
    .then(makeNullUndefined);
  if (!lastRange) {
    return;
  }

  if (lastRange.end_block_id > nextBlockId) {
    logger.error('This should never happen: lastRange.end_block_id > nextBlockId', {
      nextBlockId,
      lastRange,
    });
    return;
  }

  if (nextBlockId - lastRange.end_block_id === 0) {
    logger.error('This should never happen: lastRange.end_block_id == nextBlockId', {
      nextBlockId,
      lastRange,
    });
    return;
  }

  // it's fine, there is no gap between ranges
  if (nextBlockId - lastRange.end_block_id === 1) {
    return lastRange;
  }

  // we merge gaps of 1 if reorg happened and missing block doesnt exist at all
  if (nextBlockId - lastRange.end_block_id === 2) {
    const missingBlock = await getBlockById(services, nextBlockId - 1);
    if (!missingBlock) {
      return lastRange;
    } else {
      return;
    }
  }

  return undefined;
}
