import * as ethers from 'ethers';
import { getLogger } from './utils/logger';
import { withLock } from './db/locks';
import { SpockConfig, getAllProcessors } from './config';
import { createServices } from './services';
import { blockGenerator } from './blockGenerator';
import { process } from './processors/process';
import { registerProcessors } from './processors/register';
import { statsWorker } from './stats/stats';
import { printSystemInfo } from './printSystemInfo';

ethers.errors.setLogLevel('error');
const logger = getLogger('runner');

export async function etl(config: SpockConfig): Promise<void> {
  const services = await createServices(config);

  printSystemInfo(config);

  await withLock(services.db, services.config.processDbLock, async () => {
    if (services.config.onStart) {
      logger.debug('Running onStart hook.');
      await services.config.onStart(services);
    }

    await registerProcessors(services, getAllProcessors(config));

    await Promise.all([
      blockGenerator(services, config.startingBlock, config.lastBlock),
      process(services, config.extractors),
      process(services, config.transformers),
      config.statsWorker.enabled ? statsWorker(services) : Promise.resolve(),
    ]);
  });
}
