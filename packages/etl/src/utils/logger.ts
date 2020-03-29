// normal way of importing stuff doesnt work here oO
import consolaLib from 'consola'
type ConsolaType = typeof consolaLib
const consola = require('consola') as ConsolaType

const DEFAULT_LOGGING_LEVEL = 5 // log everything by default everything

const isProd = process.env.NODE_ENV === 'production'
// @todo improve types
const loggingLevel: any = process.env.VL_LOGGING_LEVEL

export function getLogger(name: string): ConsolaType {
  const commonOptions = isProd
    ? {
        reporters: [new (consola as any).JSONReporter()],
      }
    : {}

  const logger = consola
    .create({
      ...commonOptions,
      level: loggingLevel || DEFAULT_LOGGING_LEVEL,
    })
    .withTag(name)

  return logger
}
