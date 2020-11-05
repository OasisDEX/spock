import { middleware as cacheMiddleware, Options as CacheOptions } from 'apicache'
import { getLogger } from '@oasisdex/spock-etl/dist/utils/logger'
import { ApiConfig } from '../config'
import { RequestHandler } from 'express-serve-static-core'

const logger = getLogger('API/caching')

export function caching(config: ApiConfig): RequestHandler {
  const options: CacheOptions = {
    appendKey: (req: any) => config.api.responseCaching.transformKey(JSON.stringify(req.body)),
  }

  const middleware = cacheMiddleware(config.api.responseCaching.duration, undefined, options)

  logger.info('Using response cache: ', JSON.stringify({ duration: config.api.responseCaching.duration, ...options }))

  return middleware
}
