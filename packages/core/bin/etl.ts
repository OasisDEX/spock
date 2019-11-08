import { etl } from '../etl';
import { loadConfig } from '../utils/configUtils';
import { runAndHandleErrors } from './utils';

export async function main(): Promise<void> {
  const config = loadConfig();

  await etl(config);
}

runAndHandleErrors(main);
