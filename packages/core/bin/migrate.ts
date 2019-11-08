import { loadConfig } from '../utils/configUtils';
import { migrateFromConfig } from './migrateUtils';
import { runAndHandleErrors } from './utils';

export async function main(): Promise<void> {
  const config = loadConfig();

  await migrateFromConfig(config);
}

runAndHandleErrors(main);
