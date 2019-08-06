import { RetryProvider } from './ethereum/RetryProvider';
import { createDB } from './db/db';
import { SpockConfig } from './config';
import { Services, TransactionalServices } from './types';
import { getNetworkState } from './ethereum/getNetworkState';
import { sample } from 'lodash';
import { getLogger } from './utils/logger';

const logger = getLogger('services');

export async function createServices(config: SpockConfig): Promise<Services> {
  const db = createDB(config.db);
  createProviders(config);
  const provider = getRandomProvider();
  const networkState = await getNetworkState(provider);

  return {
    provider,
    ...db,
    config,
    networkState,
  };
}

export async function withTx<T>(
  services: Services,
  op: (tx: TransactionalServices) => Promise<T>,
): Promise<T> {
  return await services.db.tx(async tx => {
    const txServices: TransactionalServices = {
      ...services,
      tx,
    };

    return await op(txServices);
  });
}

let allProviders: RetryProvider[] = [];
export function createProviders(config: SpockConfig): void {
  const mainProvider = new RetryProvider(config.chain.host, config.chain.retries);
  const alternativeProviders = (config.chain.alternativeHosts || []).map(
    h => new RetryProvider(h, config.chain.retries),
  );

  allProviders = [mainProvider, ...alternativeProviders];
  logger.info(`Ethereum providers #${allProviders.length}`);
}

export function getRandomProvider(): RetryProvider {
  return sample(allProviders)!;
}
