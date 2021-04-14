#!/usr/bin/env node

import { captureException, flush } from '@sentry/node'

import { setupSentry } from '../utils/sentry'

const command = process.argv[2]
setupSentry()

try {
  require(`./${command}.js`)
} catch (e) {
  console.log(`Cant find command ${command}`)
  console.error(e)

  captureException(e)
  // need for sentry to send async requests
  flush().finally(() => process.exit(1))
}
