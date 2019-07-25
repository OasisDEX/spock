import { Services } from '../types';
import { BlockExtractor } from './extractor';
import { getJob, saveJob, WritableJobModel } from '../db/models/Job';
import { withConnection } from '../db/db';
import { getLogger } from '../utils/logger';

const logger = getLogger('register');

export async function registerProcessor(
  services: Services,
  processors: BlockExtractor[],
): Promise<void> {
  await withConnection(services.db, async c => {
    for (const processor of processors) {
      const jobModel = await getJob(c, processor.name);

      if (jobModel) {
        continue;
      }

      const job: WritableJobModel = { name: processor.name, last_block_id: 0 };
      logger.info(`Registering new processor ${processor.name}: (${JSON.stringify(job)})`);
      await saveJob(c, job);
    }
  });
}
