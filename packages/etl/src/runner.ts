#!/usr/bin/env node

import { setupSentry } from './sentry'
import { captureException, flush } from '@sentry/node'

const command = process.argv[2]
setupSentry()

try {
  require(`./bin/${command}.js`)
} catch (e) {
  console.log(`Cant find command ${command}`)
  console.error(e)

  captureException(e)
  // need for sentry to send async requests
  // tslint:disable-next-line
  flush().finally(() => process.exit(1))
}
