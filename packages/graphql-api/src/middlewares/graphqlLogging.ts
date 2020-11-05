import { RequestHandler } from 'express'
import { getLogger } from '@oasisdex/spock-etl/dist/utils/logger'

const logger = getLogger('graphQL-logger')

export const graphqlLogging: RequestHandler = (req, _res, next) => {
  if (req.method !== 'POST') {
    next()
    return
  }

  logger.info('Request: ', JSON.stringify(req.body))

  next()
}
