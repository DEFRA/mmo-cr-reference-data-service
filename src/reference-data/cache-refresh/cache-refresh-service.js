import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { validateManifest } from './manifest-validation.js'
import { hasManifestEntryChanged } from './manifest-comparison.js'
import {
  processDatasetCollection,
  PROCESSING_STAGE
} from './dataset-processing.js'
import {
  createCacheRefreshResult,
  createDatasetFailure,
  createFailedManifestResult,
  REFRESH_STAGE
} from './cache-refresh-result.js'
import { createReadinessTracker } from './readiness-tracker.js'

const DEFAULT_CLOCK = { now: () => new Date().toISOString() }
const NOOP_LOGGER = { warn: () => {}, error: () => {}, info: () => {} }

// Runs `items` through `mapFn` with at most `concurrency` in flight at once,
// preserving each result at its original index regardless of completion order.
async function mapWithConcurrency(items, concurrency, mapFn) {
  const results = Array.from({ length: items.length })
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapFn(items[currentIndex])
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

function withTimeout(promise, timeoutMs, timeoutError) {
  let timer
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function toDatasetFailureCode(stage) {
  return stage === PROCESSING_STAGE.STRUCTURAL_VALIDATION
    ? SERVICE_ERROR_CODES.SCHEMA_VALIDATION_FAILED
    : SERVICE_ERROR_CODES.BUSINESS_VALIDATION_FAILED
}

async function loadValidManifest(persistence) {
  const { manifest } = await persistence.readManifest()
  const { valid, issues } = validateManifest(manifest)
  if (!valid) {
    const error = new Error('Active manifest failed validation')
    error.code = SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
    error.issues = issues
    throw error
  }
  return manifest
}

async function processOneEntry(persistence, entry) {
  try {
    const { content } = await persistence.readCollection({
      dataset: entry.dataset,
      collectionVersion: entry.version
    })
    const result = processDatasetCollection({
      dataset: entry.dataset,
      schemaVersion: entry.schemaVersion,
      content
    })
    if (!result.ok) {
      return {
        dataset: entry.dataset,
        ok: false,
        failure: createDatasetFailure({
          dataset: entry.dataset,
          stage: result.stage,
          code: toDatasetFailureCode(result.stage),
          message: `${entry.dataset} failed ${result.stage.replace('-', ' ')}`
        })
      }
    }
    return {
      dataset: entry.dataset,
      ok: true,
      entry,
      collection: result.collection
    }
  } catch (cause) {
    return {
      dataset: entry.dataset,
      ok: false,
      failure: createDatasetFailure({
        dataset: entry.dataset,
        stage: REFRESH_STAGE.PERSISTENCE,
        code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
        message: cause.message,
        retryable: cause.retryable ?? true
      })
    }
  }
}

function publishCollection(store, entry, collection) {
  try {
    store.setCollection(entry.dataset, collection, entry)
    return null
  } catch (cause) {
    return createDatasetFailure({
      dataset: entry.dataset,
      stage: REFRESH_STAGE.PUBLICATION,
      code: cause.code ?? SERVICE_ERROR_CODES.INTERNAL_ERROR,
      message: cause.message
    })
  }
}

function findRemovedDatasets(store, currentDatasetNames) {
  return store
    .listLoadedDatasets()
    .filter((dataset) => !currentDatasetNames.includes(dataset))
    .map((dataset) =>
      createDatasetFailure({
        dataset,
        stage: REFRESH_STAGE.MANIFEST,
        code: SERVICE_ERROR_CODES.DATASET_NOT_FOUND,
        message: `${dataset} is no longer present in the active manifest; previous data retained`
      })
    )
}

async function processEntries(
  { persistence, store, refreshConcurrency },
  entries
) {
  const results = await mapWithConcurrency(
    entries,
    refreshConcurrency,
    (entry) => processOneEntry(persistence, entry)
  )
  const refreshedDatasets = []
  const failedDatasets = []

  for (const result of results) {
    if (!result.ok) {
      failedDatasets.push(result.failure)
      continue
    }
    const publicationFailure = publishCollection(
      store,
      result.entry,
      result.collection
    )
    if (publicationFailure) {
      failedDatasets.push(publicationFailure)
    } else {
      refreshedDatasets.push(result.dataset)
    }
  }

  return { refreshedDatasets, failedDatasets }
}

function computeMissingMandatoryDatasets(store, mandatoryDatasets) {
  return mandatoryDatasets.filter((dataset) => !store.hasCollection(dataset))
}

async function runHydration(deps) {
  const { persistence, store, clock, logger } = deps
  const startedAt = clock.now()
  let manifest
  try {
    manifest = await loadValidManifest(persistence)
  } catch (cause) {
    logger.warn(
      { err: cause },
      'cache-refresh: manifest unavailable during hydration'
    )
    return createFailedManifestResult({
      startedAt,
      completedAt: clock.now(),
      code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
      message: cause.message
    })
  }

  const { refreshedDatasets, failedDatasets } = await processEntries(
    deps,
    manifest.datasets
  )
  store.setManifest(manifest)

  return createCacheRefreshResult({
    startedAt,
    completedAt: clock.now(),
    manifestChanged: true,
    refreshedDatasets,
    failedDatasets
  })
}

async function runRefresh(deps) {
  const { store, clock } = deps
  const startedAt = clock.now()
  const manifest = await loadValidManifest(deps.persistence)

  const changedEntries = manifest.datasets.filter((entry) =>
    hasManifestEntryChanged(entry, store.getCollectionMetadata(entry.dataset))
  )
  const currentDatasetNames = manifest.datasets.map((entry) => entry.dataset)
  const unchangedDatasets = manifest.datasets
    .filter((entry) => !changedEntries.includes(entry))
    .map((entry) => entry.dataset)
  const removedDatasetFailures = findRemovedDatasets(store, currentDatasetNames)

  const { refreshedDatasets, failedDatasets: changedFailures } =
    await processEntries(deps, changedEntries)
  const failedDatasets = [...removedDatasetFailures, ...changedFailures]

  store.setManifest(manifest)

  return createCacheRefreshResult({
    startedAt,
    completedAt: clock.now(),
    manifestChanged:
      changedEntries.length > 0 || removedDatasetFailures.length > 0,
    refreshedDatasets,
    unchangedDatasets,
    failedDatasets,
    removedDatasets: removedDatasetFailures.map((failure) => failure.dataset)
  })
}

function createHydrateOperation(deps, readiness, hydrationTimeoutMs) {
  const { clock, logger } = deps
  let hydrationPromise = null

  return function hydrate() {
    if (hydrationPromise) {
      return hydrationPromise
    }

    const timeoutError = Object.assign(
      new Error('Startup hydration timed out'),
      { code: SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE, retryable: true }
    )

    hydrationPromise = withTimeout(
      runHydration(deps),
      hydrationTimeoutMs,
      timeoutError
    )
      .catch((cause) => {
        logger.error({ err: cause }, 'cache-refresh: startup hydration failed')
        return createFailedManifestResult({
          startedAt: clock.now(),
          completedAt: clock.now(),
          code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
          message: cause.message
        })
      })
      .finally(() => {
        readiness.markHydrated(clock.now())
        hydrationPromise = null
      })

    return hydrationPromise
  }
}

function createRefreshOperation(deps, readiness) {
  const { clock, logger } = deps
  let refreshPromise = null

  return function refresh() {
    if (refreshPromise) {
      return refreshPromise
    }

    const startedAt = clock.now()
    refreshPromise = runRefresh(deps)
      .catch((cause) => {
        logger.warn({ err: cause }, 'cache-refresh: refresh cycle failed')
        return createFailedManifestResult({
          startedAt,
          completedAt: clock.now(),
          code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
          message: cause.message
        })
      })
      .then((result) => {
        readiness.markRefreshed({ timestamp: startedAt, status: result.status })
        return result
      })
      .finally(() => {
        refreshPromise = null
      })

    return refreshPromise
  }
}

function createGetReadinessState(store, mandatoryDatasets, readiness) {
  return function getReadinessState() {
    const flags = readiness.getFlags()
    const missingMandatoryDatasets = computeMissingMandatoryDatasets(
      store,
      mandatoryDatasets
    )
    return {
      ready:
        flags.hydrated &&
        !flags.shuttingDown &&
        missingMandatoryDatasets.length === 0,
      ...flags,
      missingMandatoryDatasets
    }
  }
}

/**
 * Creates an isolated Cache Refresh Module instance. Accesses persisted data only
 * through `persistence` (the Step 07 repository contract) and updates state only
 * through `store` (the Step 05 in-memory store contract) — never the AWS SDK, never
 * Floci, never the Authentication Service.
 */
export function createCacheRefreshService({
  persistence,
  store,
  mandatoryDatasets,
  hydrationTimeoutMs,
  refreshConcurrency,
  logger = NOOP_LOGGER,
  clock = DEFAULT_CLOCK
}) {
  const deps = { persistence, store, refreshConcurrency, clock, logger }
  const readiness = createReadinessTracker()

  return {
    hydrate: createHydrateOperation(deps, readiness, hydrationTimeoutMs),
    refresh: createRefreshOperation(deps, readiness),
    getReadinessState: createGetReadinessState(
      store,
      mandatoryDatasets,
      readiness
    ),
    markShuttingDown: () => readiness.markShuttingDown()
  }
}
