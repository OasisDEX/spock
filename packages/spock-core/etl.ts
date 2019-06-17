import * as ethers from 'ethers';
import { createDB } from './db/db';
import { Services, blockGenerator } from './generator';
import { RetryProvider } from './ethereum/RetryProvider';
import { extract, queueNewBlocksToExtract } from './extractors/extractor';
import { queueNewBlocksToTransform, transform } from './transformers/transformers';
import { getLogger } from './utils/logger';
import { withLock } from './db/locks';
import { Vulcan2xConfig } from './config';

ethers.errors.setLogLevel('error');
const logger = getLogger('runner');

function printSystemInfo(config: Vulcan2xConfig): void {
  logger.info('Starting vulcan2x');
  logger.info(`Ethereum node: ${config.chain.host}`);
}

export async function etl(config: Vulcan2xConfig): Promise<void> {
  const provider = new RetryProvider(config.chain.host, config.chain.retries);
  const db = createDB(config.db);

  const services: Services = {
    provider,
    ...db,
    config,
  };

  printSystemInfo(config);

  await withLock(services.db, services.config.processDbLock, async () => {
    await Promise.all([
      blockGenerator(services, config.startingBlock, (tx, blocks) => {
        return Promise.all([
          queueNewBlocksToExtract(tx, config.extractors, blocks),
          queueNewBlocksToTransform(tx, config.transformers, blocks),
        ]);
      }),
      extract(services, config.extractors),
      transform(services, config.transformers, config.extractors),
    ]);
  });
}
