import { randomUUID } from 'node:crypto'

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { LOG_EVENTS } from '#/common/domain/log-events.js'
import {
  recordCounter,
  recordDuration,
  recordGauge,
  METRIC_NAMES
} from '#/common/helpers/observability/metrics.js'
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

function durationMs(startedAt, completedAt) {
  return new Date(completedAt).getTime() - new Date(startedAt).getTime()
}

// Logs one safe line per failed dataset (dataset, stage, code — never the
// collection content or a raw error object) rather than a single aggregate line,
// so each dataset failure remains individually queryable/alertable.
function logDatasetFailures(logger, operationId, failedDatasets) {
  for (const failure of failedDatasets) {
    logger.warn(
      {
        event: LOG_EVENTS.DATASET_HYDRATION_FAILED,
        operationId,
        dataset: failure.dataset,
        failureStage: failure.stage,
        errorCode: failure.code,
        retryable: failure.retryable
      },
      'cache-refresh: dataset failed to load; previous data retained where available'
    )
  }
}

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

// Logs and meters the outcome of one hydrate() invocation, then returns the result
// unchanged so it can be chained directly onto the hydration promise.
function recordHydrationOutcome(logger, operationId, startedAt, result) {
  if (result.status === 'failed') {
    const [failure] = result.failedDatasets
    logger.error(
      {
        event: LOG_EVENTS.HYDRATION_FAILED,
        operationId,
        errorCode:
          failure?.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
      },
      'cache-refresh: startup hydration failed'
    )
    recordCounter(METRIC_NAMES.HYDRATION_FAILURES_TOTAL)
  } else {
    logDatasetFailures(logger, operationId, result.failedDatasets)
    logger.info(
      {
        event: LOG_EVENTS.HYDRATION_COMPLETED,
        operationId,
        result: result.status,
        refreshedDatasetCount: result.refreshedDatasets.length,
        failedDatasetCount: result.failedDatasets.length,
        durationMs: durationMs(startedAt, result.completedAt)
      },
      'cache-refresh: startup hydration completed'
    )
    if (result.failedDatasets.length > 0) {
      recordCounter(METRIC_NAMES.HYDRATION_FAILURES_TOTAL)
    }
  }
  recordDuration(
    METRIC_NAMES.HYDRATION_DURATION_MS,
    durationMs(startedAt, result.completedAt)
  )
  return result
}

function createHydrateOperation(
  deps,
  readiness,
  hydrationTimeoutMs,
  getReadinessState
) {
  const { clock, logger } = deps
  let hydrationPromise = null

  return function hydrate() {
    if (hydrationPromise) {
      return hydrationPromise
    }

    const operationId = randomUUID()
    const startedAt = clock.now()
    logger.info(
      { event: LOG_EVENTS.HYDRATION_STARTED, operationId },
      'cache-refresh: startup hydration started'
    )

    const timeoutError = Object.assign(
      new Error('Startup hydration timed out'),
      { code: SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE, retryable: true }
    )

    hydrationPromise = withTimeout(
      runHydration(deps),
      hydrationTimeoutMs,
      timeoutError
    )
      .catch((cause) =>
        createFailedManifestResult({
          startedAt: clock.now(),
          completedAt: clock.now(),
          code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
          message: cause.message
        })
      )
      .then((result) =>
        recordHydrationOutcome(logger, operationId, startedAt, result)
      )
      .finally(() => {
        readiness.markHydrated(clock.now())
        recordGauge(METRIC_NAMES.READINESS, getReadinessState().ready ? 1 : 0)
        hydrationPromise = null
      })

    return hydrationPromise
  }
}

// Logs and meters a rejected refresh cycle, then returns a failed result so the
// promise chain can continue through the shared outcome handling below.
function logRefreshFailure(logger, operationId, startedAt, clock, cause) {
  logger.warn(
    {
      event: LOG_EVENTS.REFRESH_FAILED,
      operationId,
      errorCode: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
    },
    'cache-refresh: refresh cycle failed'
  )
  recordCounter(METRIC_NAMES.REFRESH_FAILURES_TOTAL)
  return createFailedManifestResult({
    startedAt,
    completedAt: clock.now(),
    code: cause.code ?? SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
    message: cause.message
  })
}

// Logs and meters the outcome of one refresh() invocation, updates the readiness
// tracker, then returns the result unchanged so it can be chained directly.
function recordRefreshOutcome(
  logger,
  readiness,
  operationId,
  startedAt,
  result
) {
  const completedEvent =
    result.failedDatasets.length > 0
      ? LOG_EVENTS.REFRESH_COMPLETED_WITH_ERRORS
      : LOG_EVENTS.REFRESH_COMPLETED
  if (result.status !== 'failed') {
    logDatasetFailures(logger, operationId, result.failedDatasets)
    logger.info(
      {
        event: completedEvent,
        operationId,
        result: result.status,
        changedDatasetCount: result.refreshedDatasets.length,
        failedDatasetCount: result.failedDatasets.length,
        durationMs: durationMs(startedAt, result.completedAt)
      },
      'cache-refresh: refresh completed'
    )
    if (result.failedDatasets.length > 0) {
      recordCounter(METRIC_NAMES.REFRESH_FAILURES_TOTAL)
    }
    if (result.refreshedDatasets.length > 0) {
      recordCounter(
        METRIC_NAMES.REFRESH_CHANGED_DATASETS_TOTAL,
        result.refreshedDatasets.length
      )
    }
  }
  recordDuration(
    METRIC_NAMES.REFRESH_DURATION_MS,
    durationMs(startedAt, result.completedAt)
  )
  readiness.markRefreshed({ timestamp: startedAt, status: result.status })
  return result
}

function createRefreshOperation(deps, readiness, getReadinessState) {
  const { clock, logger } = deps
  let refreshPromise = null

  return function refresh() {
    if (refreshPromise) {
      logger.info(
        { event: LOG_EVENTS.REFRESH_SKIPPED },
        'cache-refresh: refresh skipped because one is already running'
      )
      return refreshPromise
    }

    const operationId = randomUUID()
    const startedAt = clock.now()
    logger.info(
      { event: LOG_EVENTS.REFRESH_STARTED, operationId },
      'cache-refresh: refresh started'
    )

    refreshPromise = runRefresh(deps)
      .catch((cause) =>
        logRefreshFailure(logger, operationId, startedAt, clock, cause)
      )
      .then((result) =>
        recordRefreshOutcome(logger, readiness, operationId, startedAt, result)
      )
      .finally(() => {
        recordGauge(METRIC_NAMES.READINESS, getReadinessState().ready ? 1 : 0)
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
  const getReadinessState = createGetReadinessState(
    store,
    mandatoryDatasets,
    readiness
  )

  return {
    hydrate: createHydrateOperation(
      deps,
      readiness,
      hydrationTimeoutMs,
      getReadinessState
    ),
    refresh: createRefreshOperation(deps, readiness, getReadinessState),
    getReadinessState,
    markShuttingDown: () => {
      readiness.markShuttingDown()
      recordGauge(METRIC_NAMES.READINESS, getReadinessState().ready ? 1 : 0)
    }
  }
}
