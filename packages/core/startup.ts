import { RetryProvider } from './ethereum/RetryProvider';
import { createDB } from './db/db';
import { SpockConfig } from './config';
import { Services } from './types';
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
