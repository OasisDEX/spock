import { validate } from '../../validate/validate-logs';
import { loadConfig } from '../utils/configUtils';

/**
 * Validates logs data against GBQ
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await validate(config);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
