import express from 'express'
import compression from 'compression'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import { join } from 'path'
import { getConfig, ApiConfig } from './config'
import { getLogger } from '@spock/etl/dist/utils/logger'
import { whitelisting } from './middlewares/whitelisting'
import { caching } from './middlewares/caching'
import { graphqlLogging } from './middlewares/graphqlLogging'
import { printSystemInfo } from '@spock/etl/dist/utils/printSystemInfo'

const ejs = require('ejs')
const { postgraphile } = require('postgraphile')
const FilterPlugin = require('postgraphile-plugin-connection-filter')

const logger = getLogger('API')

export function startAPI(config: ApiConfig): void {
  printSystemInfo(config as any)

  const app = express()
  app.use(compression())
  app.use(bodyParser.json())
  app.use(helmet())

  // Rendering options for the index page
  app.engine('html', ejs.renderFile)
  app.set('views', join(__dirname, './views'))

  // Display a page at the subdomain root
  app.get('/', (_req, res) => res.render('index.html'))

  const graphqlConfig = {
    graphiql: true,
    graphqlRoute: '/v1',
    graphiqlRoute: '/v1/console',
    appendPlugins: [FilterPlugin],
    enableCors: true,
    watchPg: true,
  }

  const schemas = ['api']

  if (config.api.whitelisting.enabled) {
    logger.info('Whitelisting enabled.')

    app.use(
      graphqlConfig.graphqlRoute,
      whitelisting(config.api.whitelisting.whitelistedQueriesDir!, config.api.whitelisting.bypassSecret!),
    )
  } else {
    logger.info('Whitelisting disabled.')
  }

  logger.info('Enabling graphQL request logging')
  app.use(graphqlConfig.graphqlRoute, graphqlLogging)

  if (config.api.responseCaching.enabled) {
    app.use(caching(config))
  } else {
    logger.info('Running without cache')
  }

  app.use(postgraphile(config.db, schemas, graphqlConfig))

  app.listen(config.api.port).on('listening', () => {
    logger.info(`Running a GraphQL API server at http://localhost:${config.api.port}`)
    logger.info(`Console: http://localhost:${config.api.port}/v1/console`)
  })
}

const rawPath = process.argv[3]
if (!rawPath) {
  throw new Error('You need to provide config as a first argument!')
}
const config = getConfig(process.env, rawPath)
startAPI(config)
