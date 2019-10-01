import { loadConfig } from '../utils/configUtils';
import { getLogger } from '../utils/logger';
import { migrateFromConfig } from './migrateUtils';

const logger = getLogger('migration');

export async function main(): Promise<void> {
  const config = loadConfig();

  await migrateFromConfig(config);
}

main().catch(e => {
  logger.error(e);
  console.error(e);
  process.exit(1);
});
