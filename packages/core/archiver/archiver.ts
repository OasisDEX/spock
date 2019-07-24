import { Services, TransactionalServices } from '../types';
import { findConsecutiveSubsets, getLast, delay } from '../utils';
import { saveDoneJob, updateDoneJob, DoneJob } from '../db/models/DoneJob';
import {
  ExtractedBlock,
  TaskType,
  getTableNameForTask,
  getNameFieldForTask,
} from '../db/models/extracted';
import { getLogger } from '../utils/logger';
import { getBlockRange } from '../db/models/Block';
import { withTx } from '../services';
import { sortBy } from 'lodash';

const logger = getLogger('archiver');

export async function archiver(_services: Services): Promise<void> {
  while (true) {
    await archiveOnce(_services);

    await delay(_services.config.archiverWorker.delay * 1000 * 60);
  }
}

export async function archiveOnce(_services: Services, sort: boolean = true): Promise<void> {
  for (const extractor of _services.config.extractors) {
    let done = false;
    while (!done) {
      logger.info(`Archiving ${extractor.name}`);

      await withTx(_services, async services => {
        const processed = await archiveTask(services, 'extract', extractor.name, sort);

        done = processed < services.config.archiverWorker.batch;
      });
    }

    await withTx(_services, async services => {
      await mergeRanges(services, extractor.name);
    });
  }

  // this loop could be merged to upper one and we could merge transformer together with extractors if we would have an easy way to differentiate between them (ex. instanceof check)
  for (const transformer of _services.config.transformers) {
    let done = false;
    while (!done) {
      logger.info(`Archiving ${transformer.name}`);

      await withTx(_services, async services => {
        const processed = await archiveTask(services, 'transform', transformer.name, sort);

        done = processed < services.config.archiverWorker.batch;
      });
    }

    await withTx(_services, async services => {
      await mergeRanges(services, transformer.name);
    });
  }
}

export async function archiveTask(
  services: TransactionalServices,
  type: TaskType,
  name: string,
  sort: boolean = true,
): Promise<number> {
  const table = getTableNameForTask(type);
  const nameField = getNameFieldForTask(type);
  const sql = `
  SELECT * FROM ${table} eb 
  WHERE eb.${nameField}='${name}' AND status='done' 
  ${sort ? 'ORDER BY eb.block_id ' : ''}
  LIMIT ${services.config.archiverWorker.batch};
  `;

  let blocksToAchieve = (await services.tx.manyOrNone<ExtractedBlock>(sql)) || [];
  // sort in memory
  if (!sort) {
    blocksToAchieve = sortBy(blocksToAchieve, 'block_id');
  }
  logger.info({ toArchive: blocksToAchieve.length, extractorName: name });
  const consecutiveBlocks = findConsecutiveSubsets(blocksToAchieve, 'block_id');

  for (const consecutiveBlock of consecutiveBlocks) {
    logger.log('Subset ', JSON.stringify(consecutiveBlock));
    const first = consecutiveBlock[0];
    const last = getLast(consecutiveBlock)!;

    logger.log(`Creating new range <${first.block_id}, ${last.block_id}>`);

    await saveDoneJob(services, {
      start_block_id: first.block_id,
      end_block_id: last.block_id,
      name: name,
    });

    await deleteRangeExtractedBlock(services, type, first.block_id, last.block_id, name);
  }

  return blocksToAchieve.length;
}

export async function mergeRanges(services: TransactionalServices, name: string): Promise<void> {
  const [firstRange, ...ranges] = await selectDoneExtractedBlocks(services, name);

  const rangesToDrop: DoneJob[] = [];
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

    await updateDoneJob(services, lastRange.id, {
      end_block_id: range.end_block_id,
    });
    rangesToDrop.push(range);
  }

  logger.log('Deleting not needed ranges.');
  await deleteRanges(services, rangesToDrop.map(r => r.id));
}

export async function deleteRangeExtractedBlock(
  services: TransactionalServices,
  type: TaskType,
  fromId: number,
  toId: number,
  name: string,
): Promise<void> {
  const table = getTableNameForTask(type);
  const nameField = getNameFieldForTask(type);
  const sql = `DELETE FROM ${table} WHERE block_id >= ${fromId} AND block_id <= ${toId} AND ${nameField}='${name}';`;

  await services.tx.none(sql);
}

export async function selectDoneExtractedBlocks(
  services: TransactionalServices,
  extractorName: string,
): Promise<DoneJob[]> {
  const sql = `
  SELECT * FROM vulcan2x.done_job deb 
  WHERE deb.name='${extractorName}'
  ORDER BY deb.start_block_id;`;

  return await services.tx.manyOrNone<DoneJob>(sql);
}

export async function deleteRanges(services: TransactionalServices, ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const sql = `
DELETE FROM vulcan2x.done_job
WHERE id IN (${ids.join(',')});
  `;
  await services.tx.none(sql);
}
