import * as ethers from 'ethers';
import { blockGenerator } from './generator';
import { extract, queueNewBlocksToExtract } from './extractors/extractor';
import { queueNewBlocksToTransform, transform } from './transformers/transformers';
import { getLogger } from './utils/logger';
import { withLock } from './db/locks';
import { SpockConfig } from './config';
import { createServices } from './startup';

ethers.errors.setLogLevel('error');
const logger = getLogger('runner');

function printSystemInfo(config: SpockConfig): void {
  logger.info('Starting Spock ETL...');
  logger.info(`Ethereum node: ${config.chain.host}`);
}

export async function etl(config: SpockConfig): Promise<void> {
  const services = createServices(config);

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
