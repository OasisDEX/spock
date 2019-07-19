import { Services, JobType } from '../types';
import { delay } from '../utils';
import { getLogger } from '../utils/logger';
import { Stats } from './types';
import { DoneExtractedBlock } from '../db/models/DoneExtractedBlock';

const logger = getLogger('stats');

export async function statsWorker(services: Services): Promise<void> {
  const statsCfg = services.config.statsWorker;

  logger.info('Stats process starting...');

  let lastStat: Stats | undefined;
  while (true) {
    const startTime = Date.now();
    logger.info('Sleeping...');
    await delay(statsCfg.interval * 1000 * 60);
    logger.info(`Calculating stats...`);
    const stopTime = Date.now();

    const stats = await getStats(services);
    if (lastStat) {
      const blocksSyncedDelta = stats.blocksSynced - lastStat.blocksSynced;
      const blocksExtractedDelta = stats.blocksExtracted - lastStat.blocksExtracted;
      const blocksTransformedDelta = stats.blocksTransformed - lastStat.blocksTransformed;
      const timeDeltaSec = (stopTime - startTime) / 1000;

      logger.info(`
Stats on ${new Date(stopTime).toUTCString()}}:
synced: ${(blocksSyncedDelta / timeDeltaSec).toFixed(2)} blocks/sec
extracted: ${(blocksExtractedDelta / timeDeltaSec).toFixed(2)} tasks/sec
transformed: ${(blocksTransformedDelta / timeDeltaSec).toFixed(2)} tasks/sec
      `);
    } else {
      logger.info('Missing baseline');
    }

    lastStat = stats;
  }
}

export async function getStats(services: Services): Promise<Stats> {
  const blocksSynced =
    (
      (await services.db.oneOrNone(`SELECT id FROM vulcan2x.block ORDER BY number DESC LIMIT 1;
  `)) || {}
    ).id || 0;
  const blocksExtracted = await countJobsDone(services, 'extract');
  const blocksTransformed =
    (
      (await services.db.oneOrNone(
        `SELECT id FROM vulcan2x.transformed_block WHERE status='done' ORDER BY block_id DESC LIMIT 1;`,
      )) || {}
    ).id || 0;

  return {
    blocksSynced,
    blocksExtracted,
    blocksTransformed,
  };
}

async function countJobsDone(services: Services, _type: JobType): Promise<number> {
  const countJobsDoneSQL = `
  SELECT id FROM vulcan2x.extracted_block 
  WHERE status='done' 
  ORDER BY block_id DESC 
  LIMIT 1;
  `;
  const countJobsDone: number = ((await services.db.oneOrNone(countJobsDoneSQL)) || {}).id || 0;

  const countArchivedJobsDoneSQL = `SELECT * FROM vulcan2x.done_extracted_block;`;
  const archivedRanges = await services.db.manyOrNone<DoneExtractedBlock>(countArchivedJobsDoneSQL);
  const countedArchivedJobs = archivedRanges.reduce(
    (acc, val) => acc + val.end_block_id - val.start_block_id + 1,
    0,
  );

  return countJobsDone + countedArchivedJobs;
}
