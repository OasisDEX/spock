import { getLogger } from './logger';
import { Dictionary } from 'ts-essentials';
import { entries } from 'lodash';
import * as prettyMs from 'pretty-ms';

const logger = getLogger('Timer');

const timerStats: Dictionary<number[]> = {};

export function timer(label: string, extra?: string): () => void {
  timerStats[label] = timerStats[label] || [];
  const startTime = process.hrtime.bigint();

  return () => {
    const endTime = process.hrtime.bigint();
    const result = endTime - startTime;
    const resultInMs = Number(result / 1000000n);

    logger.info(`${label} ${extra ? `(${extra})` : ''} took: ${prettyMs(resultInMs)}`);
    timerStats[label].push(resultInMs);
  };
}

export function printTimersSummary(): void {
  for (const [name, measurements] of entries(timerStats)) {
    const sum = measurements.reduce((a, c) => a + c, 0) || 0;
    const avg = measurements.length ? sum / measurements.length : 0;
    const min = Math.min(...measurements) || 0;
    const max = Math.max(...measurements) || 0;

    logger.info(
      // prettier-ignore
      `${name} - sum (${prettyMs(sum)}), avg (${prettyMs(avg)}), min (${prettyMs(min)}), max (${prettyMs(max)})`,
    );

    // clear stats
    timerStats[name] = [];
  }
  logger.info('--------');
}
