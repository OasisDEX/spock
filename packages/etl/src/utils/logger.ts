// normal way of importing stuff doesnt work here oO
import consolaLib from 'consola'
type ConsolaType = typeof consolaLib
const consola = require('consola') as ConsolaType

const DEFAULT_LOGGING_LEVEL = 5 // log everything by default everything

const loggingLevel: any = process.env.VL_LOGGING_LEVEL

export function getLogger(name: string): ConsolaType {
  const commonOptions = getCommonOptsBasedOnEnv(process.env.NODE_ENV)

  const logger = consola
    .create({
      ...commonOptions,
      level: loggingLevel ?? DEFAULT_LOGGING_LEVEL,
    })
    .withTag(name)

  return logger
}

function getCommonOptsBasedOnEnv(NODE_ENV?: string): Object {
  const isProd = NODE_ENV === 'production'
  const isTest = NODE_ENV === 'test'

  if (isProd) {
    return {
      reporters: [new (consola as any).JSONReporter()],
    }
  }
  if (isTest) {
    return {
      reporters: [],
    }
  }
  return {}
}
