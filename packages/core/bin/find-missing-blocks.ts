import { loadConfig } from '../utils/configUtils';
import { findMissingBlocks } from '../../validate/find-missing-blocks';

/**
 * Easily find missing logs
 */

export async function main(): Promise<void> {
  const config = loadConfig();

  await findMissingBlocks(config);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
