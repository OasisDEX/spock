/**
 * Script to checks if all jobs are still running
 */
import { createServices } from '../core/services';
import { withConnection } from '../core/db/db';

import { SpockConfig } from '../core/config';
import { getLogger } from '../core/utils/logger';
import { getAllJobs } from '../core/db/models/Job';

const logger = getLogger('validate-jobs');

export async function validateJobs(config: SpockConfig): Promise<void> {
  logger.info(`Running...`);

  const spockServices = await createServices(config);

  await withConnection(spockServices.db, async c => {
    const jobs = await getAllJobs(c);
    logger.info(`All jobs: ${jobs.length}`);

    const stoppedJobs = jobs.filter(j => j.status === 'stopped');

    logger.info(`Stopped jobs: ${stoppedJobs.length}`);
    if (stoppedJobs.length > 0) {
      logger.info(`Detected stopped jobs! Failing!`);
      process.exit(1);
    }
  });
}
