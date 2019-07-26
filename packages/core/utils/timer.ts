import prettyHrtime = require('pretty-hrtime');
import { getLogger } from './logger';

const logger = getLogger('Timer');

export function timer(label: string): () => void {
  const startTime = process.hrtime();

  return () => {
    const endTime = process.hrtime(startTime);

    logger.info(`${label} took: ${prettyHrtime(endTime)}`);
  };
}
