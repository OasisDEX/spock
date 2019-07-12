import { Services, TransactionalServices } from '../types';
import { findConsecutiveSubsets, getLast, delay } from '../utils';
import { saveDoneExtractedBlock } from '../db/models/DoneExtractedBlock';
import { ExtractedBlock } from '../db/models/ExtractedBlock';
import { getLogger } from '../utils/logger';

const logger = getLogger('archiver');

export async function archiver(_services: Services): Promise<void> {
  while (true) {
    for (const extractor of _services.config.extractors) {
      logger.info(`Archiving ${extractor.name}`);

      await _services.db.tx(async tx => {
        const services: TransactionalServices = {
          ..._services,
          tx,
        };

        await archiveExtractor(services, extractor.name);
      });
    }

    await delay(10 * 1000);
  }
}

export async function archiveExtractor(
  services: TransactionalServices,
  extractorName: string,
): Promise<void> {
  const sql = `SELECT * FROM vulcan2x.extracted_block eb WHERE eb.extractor_name='${extractorName}' AND status='done' ORDER BY eb.block_id LIMIT ${
    services.config.archiverWorker.batch
  };`;
  const blocksToAchieve = (await services.tx.manyOrNone<ExtractedBlock>(sql)) || [];
  logger.info({ toArchive: blocksToAchieve.length, extractorName });
  const consecutiveBlocks = findConsecutiveSubsets(blocksToAchieve, 'block_id');

  for (const consecutiveBlock of consecutiveBlocks) {
    const first = consecutiveBlock[0];
    const last = getLast(consecutiveBlock)!;

    await saveDoneExtractedBlock(services, {
      start_block_id: first.block_id,
      end_block_id: last.block_id,
      extractor_name: extractorName,
    });
    await deleteRangeExtractedBlock(services, first.block_id, last.block_id, extractorName);
  }
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
