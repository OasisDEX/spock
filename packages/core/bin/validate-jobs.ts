import { validateJobs } from '../../validate/validateJobs';
import { loadConfig } from '../utils/configUtils';

/**
 * Validates logs data against GBQ
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await validateJobs(config);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
