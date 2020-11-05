import * as fs from 'fs'
import { fromPairs } from 'lodash'
import { Dictionary } from 'ts-essentials'
import { getLogger } from '@oasisdex/spock-etl/dist/utils/logger'
import { Request, NextFunction, Response, response, RequestHandler } from 'express'

const logger = getLogger('whitelisting')

export function whitelisting(absPathToQueryDefs: string, bypassSecret: string): RequestHandler {
  const allowedQueries = readEntities(absPathToQueryDefs, '.graphql')
  logger.info(`Allowed queries (${Object.keys(allowedQueries).length}): ${Object.keys(allowedQueries).join(', ')}`)

  return (req: Request, _resp: Response, next: NextFunction) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    const devModeRequest = (req.body.variables || {}).devMode

    if (devModeRequest && devModeRequest !== bypassSecret) {
      console.log('Attempt to request dev mode but wrong secret was provided')
      response.sendStatus(403)
      return
    }

    if (devModeRequest && devModeRequest === bypassSecret) {
      console.log('Dev mode requested with correct secret')
      next()
      return
    }

    if (Object.prototype.hasOwnProperty.call(allowedQueries, req.body.operationName)) {
      req.body.query = allowedQueries[req.body.operationName]
    } else {
      logger.warn(`Query not allowed:
      query: ${req.body.query}
      operationName: ${req.body.operationName}`)
      req.body.query = null
    }

    next()
  }
}

function readEntities(dirPath: string, ext: string): Dictionary<string> {
  return fromPairs(
    fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith(ext))
      .map((file) => file.substr(0, file.length - ext.length))
      .map((file) => [file, fs.readFileSync(`${dirPath}/${file}${ext}`, 'utf-8')]),
  )
}
