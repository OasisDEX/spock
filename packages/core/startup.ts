import { RetryProvider } from './ethereum/RetryProvider';
import { createDB } from './db/db';
import { SpockConfig } from './config';
import { Services } from './types';

export function createServices(config: SpockConfig): Services {
  const provider = new RetryProvider(config.chain.host, config.chain.retries);
  const db = createDB(config.db);

  return {
    provider,
    ...db,
    config,
  };
}
