import * as ethers from 'ethers';
import { getLogger } from './utils/logger';
import { withLock } from './db/locks';
import { SpockConfig } from './config';
import { createServices } from './services';
import { archiver } from './archiver/archiver';
import { blockGenerator } from './generator';
import { queueNewBlocksToExtract, extract } from './extractors/extractor';
import { queueNewBlocksToTransform, transform } from './transformers/transformers';
import { statsWorker } from './stats/stats';

ethers.errors.setLogLevel('error');
const logger = getLogger('runner');

function printSystemInfo(config: SpockConfig): void {
  logger.info(`Starting Spock ETL ver.${getVersion()}`);
  logger.info(`Ethereum node: ${config.chain.host}`);
  logger.info('Extractor worker config:', config.extractorWorker);
  logger.info('Transformer worker config:', config.transformerWorker);
}

function getVersion(): string {
  return (require('../../package.json') || {}).version;
}

export async function etl(config: SpockConfig): Promise<void> {
  const services = await createServices(config);

  printSystemInfo(config);

  await withLock(services.db, services.config.processDbLock, async () => {
    await Promise.all([
      archiver(services),
      blockGenerator(services, config.startingBlock, (tx, blocks) => {
        return Promise.all([
          queueNewBlocksToExtract(tx, config.extractors, blocks),
          queueNewBlocksToTransform(tx, config.transformers, blocks),
        ]);
      }),
      extract(services, config.extractors),
      transform(services, config.transformers, config.extractors),
      statsWorker(services),
    ]);
  });
}
