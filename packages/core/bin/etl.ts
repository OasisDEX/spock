import { etl } from '../etl';
import { loadConfig } from '../utils/configUtils';

export async function main(): Promise<void> {
  const config = loadConfig();

  await etl(config);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
