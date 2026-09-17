// Command Module use case: deterministic local reference-data bootstrap (Step 23).
// Reuses the exact Step 22 atomic full-replacement workflow once per maintained
// dataset — this is what makes the resulting active manifest deterministic AND
// correct: collection checksums/ETags/sizes are always computed by the real
// persistence write, never hand-authored. Never imports the AWS SDK directly, never
// mutates the shared production In-Memory Data Store (a fresh, throwaway instance is
// used unless the caller injects one for testing).

import process from 'node:process'

import { config as defaultConfig } from '#/config.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { persistence as defaultPersistence } from '#/reference-data/persistence/index.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { replaceCollection } from './replace-collection.js'
import {
  loadSeedCollection as defaultLoadSeedCollection,
  SEED_DATASET_ORDER
} from './seed-loader.js'

// Fixed, committed identifiers/timestamps — never generated at bootstrap time, so
// repeated executions (and fresh Floci resets) always produce the same logical state.
export const SEED_MANIFEST_ID = '00000000-0000-4000-8000-000000000001'
export const SEED_SCHEMA_VERSION = '1.0'
export const SEED_TIMESTAMP = '2026-01-01T00:00:00Z'

const FIXED_CLOCK = Object.freeze({ now: () => SEED_TIMESTAMP })

// Local-only safeguard: every check reuses existing central configuration — no new
// environment variable, no reliance on a caller-supplied flag or the bucket name alone.
function assertLocalBootstrapAllowed(config) {
  const cdpEnvironment = config.get('cdpEnvironment')
  if (cdpEnvironment !== 'local') {
    throw new Error(
      `Local reference-data bootstrap is only permitted when cdpEnvironment is "local" (current: "${cdpEnvironment}").`
    )
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Local reference-data bootstrap must not run with NODE_ENV=production.'
    )
  }
  if (!config.get('aws.endpointUrl')) {
    throw new Error(
      'Local reference-data bootstrap requires an explicit local S3-compatible endpoint (aws.endpointUrl); refusing to run against the default AWS endpoint.'
    )
  }
}

function classifyOutcome(result) {
  if (result.outcome === 'idempotent') {
    return 'unchanged'
  }
  return result.previousCollection ? 'replaced' : 'created'
}

function summaryKeyFor(category) {
  return `${category}Datasets`
}

// Processes exactly one dataset end to end, returning either a success outcome or a
// failure descriptor — never throws, so the caller's loop needs no more than one break.
async function processSeedDataset({
  dataset,
  loadSeedCollection,
  persistence,
  store,
  clock,
  logger
}) {
  const startedAt = Date.now()
  let collection
  try {
    collection = loadSeedCollection(dataset)
  } catch (cause) {
    logger.error(
      { dataset, err: cause.message },
      'reference-data bootstrap: seed file could not be loaded'
    )
    return {
      ok: false,
      failure: { dataset, stage: 'seed-load', code: 'invalid_request' }
    }
  }

  const result = await replaceCollection({
    dataset,
    schemaVersion: SEED_SCHEMA_VERSION,
    collection,
    collectionVersion: collection.version,
    persistence,
    store,
    clock,
    manifestId: SEED_MANIFEST_ID
  })

  if (result.outcome === 'invalid') {
    logger.error(
      { dataset, stage: result.stage, errorCount: result.errors.length },
      'reference-data bootstrap: seed collection failed validation'
    )
    return {
      ok: false,
      failure: {
        dataset,
        stage: result.stage,
        code: 'schema_or_business_validation_failed'
      }
    }
  }

  const category = classifyOutcome(result)
  logger.info(
    {
      dataset,
      outcome: category,
      collectionVersion: result.collection.version,
      warningCount: result.warnings.length,
      durationMs: Date.now() - startedAt
    },
    'reference-data bootstrap: dataset processed'
  )

  return { ok: true, category, manifestVersion: result.manifest.version }
}

/**
 * @param {Object} [deps]
 * @param {import('convict').Config} [deps.config]
 * @param {import('#/common/contracts/reference-data-repository.js')} [deps.persistence]
 * @param {import('#/common/contracts/in-memory-data-store.js')} [deps.store] fresh,
 *   isolated instance by default — never the shared production singleton
 * @param {{ now: () => string }} [deps.clock]
 * @param {import('pino').Logger} [deps.logger]
 * @param {(dataset: string) => *} [deps.loadSeedCollection] injectable for tests only
 */
export async function bootstrapLocalReferenceData({
  config = defaultConfig,
  persistence = defaultPersistence,
  store = createInMemoryDataStore(),
  clock = FIXED_CLOCK,
  logger = createLogger(),
  loadSeedCollection = defaultLoadSeedCollection
} = {}) {
  assertLocalBootstrapAllowed(config)

  const summary = {
    status: 'completed',
    bucket: config.get('referenceData.bucket'),
    manifestVersion: null,
    createdDatasets: [],
    unchangedDatasets: [],
    replacedDatasets: [],
    failedDatasets: []
  }

  for (const dataset of SEED_DATASET_ORDER) {
    const outcome = await processSeedDataset({
      dataset,
      loadSeedCollection,
      persistence,
      store,
      clock,
      logger
    })

    if (!outcome.ok) {
      summary.status = 'failed'
      summary.failedDatasets.push(outcome.failure)
      break
    }

    summary[summaryKeyFor(outcome.category)].push(dataset)
    summary.manifestVersion = outcome.manifestVersion
  }

  return summary
}
