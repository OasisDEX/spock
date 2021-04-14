import hrTimeToMs from 'convert-hrtime'
import { entries } from 'lodash'
import prettyMs from 'pretty-ms'
import { Dictionary } from 'ts-essentials'

import { isProd } from '../services/config'
import { getLogger } from './logger'

const logger = getLogger('Timer')

const timerStats: Dictionary<number[]> = {}

const noop = () => {}

export function timer(label: string, extra?: string): () => void {
  if (isProd()) {
    return noop
  }

  timerStats[label] = timerStats[label] || []
  const startTime = process.hrtime()

  return () => {
    const result = process.hrtime(startTime)
    const resultInMs = tryOrDefault(() => hrTimeToMs(result).milliseconds, 0)

    logger.info(`${label} ${extra ? `(${extra})` : ''} took: ${prettyMs(resultInMs)}`)
    timerStats[label].push(resultInMs)
  }
}

export function printTimersSummary(): void {
  if (isProd()) {
    return
  }

  for (const [name, measurements] of entries(timerStats)) {
    if (measurements.length === 0) {
      logger.info(`${name} - no data`)
      continue
    }
    const sum = measurements.reduce((a, c) => a + c, 0) || 0
    const avg = measurements.length ? sum / measurements.length : 0
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)

    logger.info(
      // prettier-ignore
      `${name} - sum (${prettyMs(sum)}), avg (${prettyMs(avg)}), min (${prettyMs(min)}), max (${prettyMs(max)})`,
    )

    // clear stats
    timerStats[name] = []
  }
  logger.info('--------')
}

function tryOrDefault<T>(fn: () => T, def: T): T {
  try {
    return fn()
  } catch {
    return def
  }
}
