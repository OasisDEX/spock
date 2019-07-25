import * as ethers from 'ethers';
import { getLogger } from './utils/logger';
import { withLock } from './db/locks';
import { SpockConfig } from './config';
import { createServices } from './services';
import { blockGenerator } from './blockGenerator';
import { process } from './processors/process';
import { registerProcessors } from './processors/register';
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
    await registerProcessors(services, config.extractors);
    await registerProcessors(services, config.transformers);

    await Promise.all([
      blockGenerator(services, config.startingBlock, config.lastBlock),
      process(services, config.extractors),
      process(services, config.transformers),
      statsWorker(services),
    ]);

  });
}
