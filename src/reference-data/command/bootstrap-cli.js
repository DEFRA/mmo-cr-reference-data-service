#!/usr/bin/env node
// Explicit local-development entry point for Step 23 bootstrap. Never imported by
// application/server code — only invoked via `npm run reference-data:bootstrap`.

import process from 'node:process'

import { createLogger } from '#/common/helpers/logging/logger.js'
import { bootstrapLocalReferenceData } from './bootstrap-local-reference-data.js'

const logger = createLogger()

try {
  const summary = await bootstrapLocalReferenceData()
  logger.info(summary, 'reference-data bootstrap: summary')
  process.exitCode = summary.status === 'completed' ? 0 : 1
} catch (cause) {
  logger.error({ err: cause.message }, 'reference-data bootstrap: failed')
  process.exitCode = 1
}
