import { Services } from '../types';
import { getJob, saveJob, WritableJobModel, setJobStatus, excludeAllJobs } from '../db/models/Job';
import { withConnection, DbConnection } from '../db/db';
import { getLogger } from '../utils/logger';
import { Processor } from './types';

const logger = getLogger('register');

/**
 * Prepares vulcan2x.job table with all processors. Note: this should be called just once per ETL start!
 */
export async function registerProcessors(
  services: Services,
  processors: Processor[],
): Promise<void> {
  await withConnection(services.db, async c => {
    logger.info('De-registering all processors...');
    await excludeAllJobs(c);

    logger.info(`Registering configured processors(${processors.length})...`);
    for (const processor of processors) {
      await registerProcessor(c, processor);
    }
  });
}

async function registerProcessor(c: DbConnection, processor: Processor): Promise<void> {
  const jobModel = await getJob(c, processor.name);

  if (jobModel) {
    logger.info(
      //prettier-ignore
      `Setting processor ${processor.name} status to 'processing'. Previously: '${jobModel.status}'`,
    );
    await setJobStatus(c, jobModel, 'processing');
  } else {
    const newJob: WritableJobModel = {
      name: processor.name,
      last_block_id: 0,
      status: 'processing',
    };

    logger.info(`Registering a new processor ${processor.name}: (${JSON.stringify(newJob)})`);
    await saveJob(c, newJob);
  }
}
