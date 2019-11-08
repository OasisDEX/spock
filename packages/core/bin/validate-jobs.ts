import { validateJobs } from '../../validate/validateJobs';
import { loadConfig } from '../utils/configUtils';
import { runAndHandleErrors } from './utils';

/**
 * Validates logs data against GBQ
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await validateJobs(config);
}

runAndHandleErrors(main);
