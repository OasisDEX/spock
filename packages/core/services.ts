import { RetryProvider } from './ethereum/RetryProvider';
import { createDB } from './db/db';
import { SpockConfig } from './config';
import { Services, TransactionalServices } from './types';
import { getNetworkState } from './ethereum/getNetworkState';

export async function createServices(config: SpockConfig): Promise<Services> {
  const provider = new RetryProvider(config.chain.host, config.chain.retries);
  const db = createDB(config.db);
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
