import { validateLogs } from '../../validate/validateLogs';
import { loadConfig } from '../utils/configUtils';

/**
 * Validates logs data against GBQ
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await validateLogs(config);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
