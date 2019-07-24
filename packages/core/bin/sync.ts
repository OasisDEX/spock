/**
 * Produces jobs (extracted_block, transformed block rows) for all defined extractors and transformers. It is safe to run this multiple times, in fact it's required to run this script after adding new extractor/block to process past blocks.
 */

import { withConnection } from '../db/db';
import { BlockExtractor } from '../extractors/extractor';
import { BlockTransformer } from '../transformers/transformers';
import { chunk } from 'lodash';
import { loadConfig } from '../utils/configUtils';
import { withLock } from '../db/locks';
import { archiveOnce } from '../archiver/archiver';
import { createServices } from '../services';
import { Services } from '../types';
import { DoneJob } from '../db/models/DoneJob';
import { getTableNameForTask, TaskType, getNameFieldForTask } from '../db/models/extracted';

async function main(): Promise<void> {
  const config = loadConfig();
  const services = await createServices(config);
  const { extractors, transformers } = config;

  await withLock(services.db, config.processDbLock, async () => {
    await archiveOnce(services, false);

    for (const extractor of extractors) {
      let res = 0;
      do {
        res = await produceMissingJobs(services, 'extract', extractor);
      } while (res !== 0);
    }

    for (const transformer of transformers) {
      let res = 0;
      do {
        res = await produceMissingJobs(services, 'transform', transformer);
      } while (res !== 0);
    }
  });

  console.log('DONE!');
  process.exit(0);
}

async function getAllDoneJobs(services: Services, name: string): Promise<DoneJob[]> {
  const sql = `SELECT * FROM vulcan2x.done_job dj 
  WHERE dj.name='${name}';`;

  return await withConnection(services.db, async c => {
    return c.manyOrNone<DoneJob>(sql);
  });
}

async function produceMissingJobs(
  services: Services,
  taskType: TaskType,
  task: BlockExtractor | BlockTransformer,
): Promise<number> {
  const extractedRanges = await getAllDoneJobs(services, task.name);

  return await withConnection(services.db, async c => {
    const table = getTableNameForTask(taskType);
    const nameField = getNameFieldForTask(taskType);

    const missing = await c.manyOrNone(
      `
  SELECT b.* 
  FROM (
    SELECT * FROM vulcan2x.block b
    ${
      extractedRanges.length > 0
        ? `WHERE ${extractedRanges
            .map(er => `(b.id < ${er.start_block_id} OR b.id > ${er.end_block_id})`)
            .join(' AND ')}`
        : ''
    }
  ) b
  LEFT OUTER JOIN ${table} eb ON b.id=eb.block_id AND eb.${nameField}='${task.name}'
  WHERE eb.id IS NULL 
  ORDER BY b.number 
  LIMIT 50000
  `,
    );

    console.log(`Missing ${task.name} jobs: ${missing.length}`);

    const jobs = chunk(missing, 1000).map(missingChunk => {
      return c.none(
        `
INSERT INTO ${table} (block_id, ${nameField}, status) 
VALUES ${missingChunk.map(m => `(${m.id}, '${task.name}', 'new')`).join(',')};`,
      );
    });

    await Promise.all(jobs);

    return missing.length;
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
