import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/common/helpers/observability/metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    recordCounter: vi.fn(),
    recordDuration: vi.fn(),
    recordGauge: vi.fn()
  }
})

import { createCacheRefreshService } from './cache-refresh-service.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { getDatasetCapabilities } from '#/common/domain/datasets.js'
import '#/reference-data/validation/index.js'

import validVesselsCollection from '#/common/schemas/fixtures/valid/vessels.json' with { type: 'json' }
import validGearsCollection from '#/common/schemas/fixtures/valid/gears.json' with { type: 'json' }
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }
import validSpeciesCollection from '#/common/schemas/fixtures/valid/species.json' with { type: 'json' }
import validMapLandCollection from '#/common/schemas/fixtures/valid/map-land.json' with { type: 'json' }
import validMapStatisticalAreasCollection from '#/common/schemas/fixtures/valid/map-statistical-areas.json' with { type: 'json' }

const MANDATORY_DATASETS = [
  'vessels',
  'gears',
  'ports',
  'species',
  'map-land',
  'map-statistical-areas'
]

const CONTENT_BY_DATASET = {
  vessels: validVesselsCollection,
  gears: validGearsCollection,
  ports: validPortsCollection,
  species: validSpeciesCollection,
  'map-land': validMapLandCollection,
  'map-statistical-areas': validMapStatisticalAreasCollection
}

function entryFor(dataset, overrides = {}) {
  return {
    dataset,
    collectionId: '11111111-1111-4111-8111-111111111111',
    schemaVersion: '1.0',
    version: '2026.09.11.1',
    format: getDatasetCapabilities(dataset).format,
    etag: 'etag-1',
    checksum: 'checksum-1',
    itemCount: 1,
    sizeBytes: 100,
    lastModified: '2026-09-11T08:30:00Z',
    ...overrides
  }
}

function buildManifest(datasets, entryOverridesByDataset = {}) {
  return {
    manifestId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    version: '2026.09.11.1',
    generatedAt: '2026-09-11T08:30:00Z',
    datasets: datasets.map((dataset) =>
      entryFor(dataset, entryOverridesByDataset[dataset])
    )
  }
}

function createFakePersistence({
  manifest,
  contentByDataset,
  readCollectionSpy
}) {
  return {
    readManifest: async () => ({ manifest, metadata: {} }),
    readCollection: async ({ dataset, collectionVersion }) => {
      readCollectionSpy?.(dataset, collectionVersion)
      const content = contentByDataset[dataset]
      if (content === undefined) {
        const error = new Error(`no content configured for ${dataset}`)
        error.code = 'dataset_not_found'
        throw error
      }
      if (content instanceof Error) {
        throw content
      }
      return { content, metadata: {} }
    }
  }
}

function createService({
  manifest,
  contentByDataset,
  readCollectionSpy,
  ...overrides
}) {
  return createCacheRefreshService({
    persistence: createFakePersistence({
      manifest,
      contentByDataset,
      readCollectionSpy
    }),
    store: createInMemoryDataStore(),
    mandatoryDatasets: MANDATORY_DATASETS,
    hydrationTimeoutMs: 5000,
    refreshConcurrency: 3,
    clock: { now: () => '2026-09-11T08:30:00.000Z' },
    ...overrides
  })
}

describe('#cacheRefreshService hydration', () => {
  test('hydrates every mandatory dataset successfully and reports ready', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET
    })

    const result = await service.hydrate()

    expect(result.status).toBe('completed')
    expect(result.refreshedDatasets).toEqual(MANDATORY_DATASETS.slice().sort())
    expect(service.getReadinessState().ready).toBe(true)
    expect(service.getReadinessState().missingMandatoryDatasets).toEqual([])
  })

  test('a missing mandatory dataset in the manifest leaves the service not ready', async () => {
    const manifest = buildManifest(
      MANDATORY_DATASETS.filter((d) => d !== 'species')
    )
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET
    })

    await service.hydrate()

    const readinessState = service.getReadinessState()
    expect(readinessState.ready).toBe(false)
    expect(readinessState.missingMandatoryDatasets).toEqual(['species'])
  })

  test('a structurally invalid persisted collection fails that dataset without blocking others', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: {
        ...CONTENT_BY_DATASET,
        species: { dataset: 'species' }
      }
    })

    const result = await service.hydrate()

    expect(result.status).toBe('completed-with-errors')
    expect(result.failedDatasets).toEqual([
      expect.objectContaining({
        dataset: 'species',
        stage: 'structural-validation'
      })
    ])
    expect(service.getReadinessState().missingMandatoryDatasets).toEqual([
      'species'
    ])
    expect(service.getReadinessState().ready).toBe(false)
    // Other datasets still hydrated successfully.
    expect(result.refreshedDatasets).toContain('vessels')
  })

  test('a manifest read failure leaves the service not ready without throwing', async () => {
    const service = createCacheRefreshService({
      persistence: {
        readManifest: async () => {
          throw new Error('S3 unavailable')
        }
      },
      store: createInMemoryDataStore(),
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })

    const result = await service.hydrate()

    expect(result.status).toBe('failed')
    expect(service.getReadinessState().ready).toBe(false)
  })

  test('concurrent hydrate() calls share a single in-flight execution', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const readCollectionSpy = vi.fn()
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET,
      readCollectionSpy
    })

    const [first, second] = await Promise.all([
      service.hydrate(),
      service.hydrate()
    ])

    expect(first).toBe(second)
    expect(readCollectionSpy).toHaveBeenCalledTimes(MANDATORY_DATASETS.length)
  })

  test('does not mutate the persisted content', async () => {
    const manifest = buildManifest(['ports'])
    const before = structuredClone(validPortsCollection)
    const service = createService({
      manifest,
      contentByDataset: { ports: validPortsCollection }
    })

    await service.hydrate()

    expect(validPortsCollection).toEqual(before)
  })
})

describe('#cacheRefreshService hydration timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('a timed-out hydration reports failure and does not publish', async () => {
    const service = createCacheRefreshService({
      persistence: {
        readManifest: () => new Promise(() => {}) // never resolves
      },
      store: createInMemoryDataStore(),
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 1000,
      refreshConcurrency: 3
    })

    const resultPromise = service.hydrate()
    await vi.advanceTimersByTimeAsync(1000)
    const result = await resultPromise

    expect(result.status).toBe('failed')
    expect(service.getReadinessState().missingMandatoryDatasets).toEqual(
      MANDATORY_DATASETS
    )
  })
})

describe('#cacheRefreshService refresh', () => {
  test('reports every dataset unchanged when nothing changed since hydration', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const readCollectionSpy = vi.fn()
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET,
      readCollectionSpy
    })
    await service.hydrate()
    readCollectionSpy.mockClear()

    const result = await service.refresh()

    expect(result.refreshedDatasets).toEqual([])
    expect(result.unchangedDatasets).toEqual(MANDATORY_DATASETS.slice().sort())
    expect(readCollectionSpy).not.toHaveBeenCalled()
  })

  test('only downloads a changed dataset, once', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const readCollectionSpy = vi.fn()
    const changedManifest = buildManifest(MANDATORY_DATASETS, {
      ports: { checksum: 'checksum-2' }
    })

    const store = createInMemoryDataStore()
    const initialService = createCacheRefreshService({
      persistence: createFakePersistence({
        manifest,
        contentByDataset: CONTENT_BY_DATASET
      }),
      store,
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })
    await initialService.hydrate()

    const refreshingService = createCacheRefreshService({
      persistence: createFakePersistence({
        manifest: changedManifest,
        contentByDataset: CONTENT_BY_DATASET,
        readCollectionSpy
      }),
      store,
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })

    const result = await refreshingService.refresh()

    expect(result.refreshedDatasets).toEqual(['ports'])
    expect(result.unchangedDatasets).toEqual(
      MANDATORY_DATASETS.filter((d) => d !== 'ports').sort()
    )
    expect(readCollectionSpy).toHaveBeenCalledTimes(1)
    expect(readCollectionSpy).toHaveBeenCalledWith('ports', '2026.09.11.1')
  })

  test('a failed dataset refresh retains the previous valid collection', async () => {
    const store = createInMemoryDataStore()
    const state = {
      manifest: buildManifest(MANDATORY_DATASETS),
      contentByDataset: CONTENT_BY_DATASET
    }
    const service = createCacheRefreshService({
      persistence: {
        readManifest: async () => ({ manifest: state.manifest, metadata: {} }),
        readCollection: async ({ dataset }) => ({
          content: state.contentByDataset[dataset],
          metadata: {}
        })
      },
      store,
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })
    await service.hydrate()
    const previousPorts = store.getCollection('ports')

    state.manifest = buildManifest(MANDATORY_DATASETS, {
      ports: { checksum: 'checksum-2' }
    })
    state.contentByDataset = {
      ...CONTENT_BY_DATASET,
      ports: { dataset: 'ports' }
    }

    const result = await service.refresh()

    expect(result.status).toBe('completed-with-errors')
    expect(result.failedDatasets).toEqual([
      expect.objectContaining({
        dataset: 'ports',
        stage: 'structural-validation'
      })
    ])
    expect(store.getCollection('ports')).toEqual(previousPorts)
    expect(service.getReadinessState().ready).toBe(true)
  })

  test('a mandatory dataset removed from the manifest is reported as failed and retained', async () => {
    const store = createInMemoryDataStore()
    const manifest = buildManifest(MANDATORY_DATASETS)
    const initialService = createCacheRefreshService({
      persistence: createFakePersistence({
        manifest,
        contentByDataset: CONTENT_BY_DATASET
      }),
      store,
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })
    await initialService.hydrate()

    const manifestWithoutSpecies = buildManifest(
      MANDATORY_DATASETS.filter((d) => d !== 'species')
    )
    const refreshingService = createCacheRefreshService({
      persistence: createFakePersistence({
        manifest: manifestWithoutSpecies,
        contentByDataset: CONTENT_BY_DATASET
      }),
      store,
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })

    const result = await refreshingService.refresh()

    expect(result.removedDatasets).toEqual(['species'])
    expect(result.failedDatasets).toEqual([
      expect.objectContaining({ dataset: 'species' })
    ])
    expect(store.hasCollection('species')).toBe(true)
  })

  test('overlapping refresh calls share the same in-flight execution', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const readManifestSpy = vi.fn(async () => ({ manifest, metadata: {} }))
    const service = createCacheRefreshService({
      persistence: {
        readManifest: readManifestSpy,
        readCollection: async ({ dataset }) => ({
          content: CONTENT_BY_DATASET[dataset],
          metadata: {}
        })
      },
      store: createInMemoryDataStore(),
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })

    const [first, second] = await Promise.all([
      service.refresh(),
      service.refresh()
    ])

    expect(first).toBe(second)
    expect(readManifestSpy).toHaveBeenCalledTimes(1)
  })

  test('the overlap guard is released after a failure, allowing a later refresh', async () => {
    let shouldFail = true
    const manifest = buildManifest(['ports'])
    const service = createCacheRefreshService({
      persistence: {
        readManifest: async () => {
          if (shouldFail) {
            shouldFail = false
            throw new Error('temporary failure')
          }
          return { manifest, metadata: {} }
        },
        readCollection: async () => ({
          content: validPortsCollection,
          metadata: {}
        })
      },
      store: createInMemoryDataStore(),
      mandatoryDatasets: ['ports'],
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3
    })

    const first = await service.refresh()
    expect(first.status).toBe('failed')

    const second = await service.refresh()
    expect(second.status).toBe('completed')
  })
})

describe('#cacheRefreshService shutdown', () => {
  test('markShuttingDown makes the service not ready even with valid mandatory data', async () => {
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET
    })
    await service.hydrate()
    expect(service.getReadinessState().ready).toBe(true)

    service.markShuttingDown()

    expect(service.getReadinessState().ready).toBe(false)
    expect(service.getReadinessState().shuttingDown).toBe(true)
  })
})

describe('#cacheRefreshService observability', () => {
  function createSpyLogger() {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  }

  function eventNames(spy) {
    return spy.mock.calls.map(([fields]) => fields.event)
  }

  test('hydrate() logs started/completed with a shared operationId and records duration', async () => {
    const { recordDuration, recordGauge } =
      await import('#/common/helpers/observability/metrics.js')
    const logger = createSpyLogger()
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET,
      logger
    })

    await service.hydrate()

    expect(eventNames(logger.info)).toEqual([
      'reference_data.hydration_started',
      'reference_data.hydration_completed'
    ])
    const [started] = logger.info.mock.calls[0]
    const [completed] = logger.info.mock.calls[1]
    expect(started.operationId).toEqual(expect.any(String))
    expect(completed.operationId).toBe(started.operationId)
    expect(completed.durationMs).toBeGreaterThanOrEqual(0)
    expect(recordDuration).toHaveBeenCalledWith(
      'reference_data_hydration_duration_ms',
      expect.any(Number)
    )
    expect(recordGauge).toHaveBeenCalledWith('reference_data_readiness', 1)
  })

  test('a failed dataset during hydration logs a dataset-level warning and a failure metric', async () => {
    const { recordCounter } =
      await import('#/common/helpers/observability/metrics.js')
    const logger = createSpyLogger()
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: {
        ...CONTENT_BY_DATASET,
        species: { dataset: 'species' }
      },
      logger
    })

    await service.hydrate()

    expect(eventNames(logger.warn)).toEqual([
      'reference_data.dataset_hydration_failed'
    ])
    expect(logger.warn.mock.calls[0][0]).toMatchObject({ dataset: 'species' })
    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_hydration_failures_total'
    )
  })

  test('a manifest read failure logs hydration_failed and never hydration_completed', async () => {
    const logger = createSpyLogger()
    const service = createCacheRefreshService({
      persistence: {
        readManifest: async () => {
          throw new Error('S3 unavailable')
        }
      },
      store: createInMemoryDataStore(),
      mandatoryDatasets: MANDATORY_DATASETS,
      hydrationTimeoutMs: 5000,
      refreshConcurrency: 3,
      logger
    })

    await service.hydrate()

    expect(eventNames(logger.error)).toEqual([
      'reference_data.hydration_failed'
    ])
    expect(eventNames(logger.info)).toEqual([
      'reference_data.hydration_started'
    ])
    expect(logger.error.mock.calls[0][0]).not.toHaveProperty('err')
  })

  test('refresh() logs started/completed and a second concurrent call logs skipped', async () => {
    const logger = createSpyLogger()
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET,
      logger
    })
    await service.hydrate()
    logger.info.mockClear()

    const first = service.refresh()
    const second = service.refresh()
    await Promise.all([first, second])

    expect(eventNames(logger.info)).toEqual([
      'reference_data.refresh_started',
      'reference_data.refresh_skipped',
      'reference_data.refresh_completed'
    ])
  })

  test('markShuttingDown updates the readiness gauge to 0', async () => {
    const { recordGauge } =
      await import('#/common/helpers/observability/metrics.js')
    const manifest = buildManifest(MANDATORY_DATASETS)
    const service = createService({
      manifest,
      contentByDataset: CONTENT_BY_DATASET
    })
    await service.hydrate()
    recordGauge.mockClear()

    service.markShuttingDown()

    expect(recordGauge).toHaveBeenCalledWith('reference_data_readiness', 0)
  })
})
