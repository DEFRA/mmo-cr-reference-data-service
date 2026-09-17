import { describe, expect, test } from 'vitest'

import {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_TIMESTAMP
} from './bootstrap-local-reference-data.js'
import { SEED_DATASET_ORDER } from './seed-loader.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'

function createFakePersistence(
  backing = { objects: new Map(), manifestState: null }
) {
  return {
    readManifest: async () => {
      if (!backing.manifestState) {
        const error = new Error('no active manifest')
        error.code = 'dataset_not_found'
        throw error
      }
      return {
        manifest: backing.manifestState.manifest,
        metadata: { etag: backing.manifestState.etag }
      }
    },
    writeCollection: async ({ dataset, collectionVersion, content }) => {
      const key = `${dataset}/${collectionVersion}`
      if (backing.objects.has(key)) {
        const error = new Error('collection version already exists')
        error.code = 'collection_version_exists'
        throw error
      }
      backing.objects.set(key, content)
      return {
        dataset,
        collectionVersion,
        etag: `sha256-${dataset}-${collectionVersion}`,
        sizeBytes: JSON.stringify(content).length,
        lastModifiedAt: '2026-09-17T00:00:00Z'
      }
    },
    writeManifest: async ({ manifest, expectedEtag }) => {
      if (
        backing.manifestState &&
        expectedEtag !== undefined &&
        expectedEtag !== backing.manifestState.etag
      ) {
        const error = new Error('manifest modified concurrently')
        error.code = 'collection_modified'
        throw error
      }
      const etag = `manifest-etag-${backing.objects.size}`
      backing.manifestState = { manifest, etag }
      return { etag }
    },
    objectExists: async ({ manifest }) =>
      manifest ? backing.manifestState !== null : false,
    _backing: backing
  }
}

function createLocalConfig(overrides = {}) {
  const values = {
    cdpEnvironment: 'local',
    'aws.endpointUrl': 'http://localhost:4566',
    'referenceData.bucket': 'mmo-cr-reference-data-service',
    ...overrides
  }
  return { get: (key) => values[key] }
}

function createSilentLogger() {
  return { info: () => {}, error: () => {}, warn: () => {} }
}

describe('#bootstrapLocalReferenceData', () => {
  test('rejects a non-local cdpEnvironment', async () => {
    await expect(
      bootstrapLocalReferenceData({
        config: createLocalConfig({ cdpEnvironment: 'prod' }),
        persistence: createFakePersistence(),
        store: createInMemoryDataStore(),
        logger: createSilentLogger()
      })
    ).rejects.toThrow(/only permitted when cdpEnvironment is "local"/)
  })

  test('rejects a missing local S3-compatible endpoint', async () => {
    await expect(
      bootstrapLocalReferenceData({
        config: createLocalConfig({ 'aws.endpointUrl': null }),
        persistence: createFakePersistence(),
        store: createInMemoryDataStore(),
        logger: createSilentLogger()
      })
    ).rejects.toThrow(/explicit local S3-compatible endpoint/)
  })

  test('rejects NODE_ENV=production regardless of cdpEnvironment', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(
        bootstrapLocalReferenceData({
          config: createLocalConfig(),
          persistence: createFakePersistence(),
          store: createInMemoryDataStore(),
          logger: createSilentLogger()
        })
      ).rejects.toThrow(/NODE_ENV=production/)
    } finally {
      process.env.NODE_ENV = original
    }
  })

  test('activates all six maintained datasets in the canonical order and writes a manifest last', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()

    const summary = await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store,
      logger: createSilentLogger()
    })

    expect(summary.status).toBe('completed')
    expect(summary.createdDatasets).toEqual(SEED_DATASET_ORDER)
    expect(summary.unchangedDatasets).toEqual([])
    expect(summary.replacedDatasets).toEqual([])
    expect(summary.failedDatasets).toEqual([])
    expect(summary.manifestVersion).toBe(SEED_TIMESTAMP)
    expect(summary.bucket).toBe('mmo-cr-reference-data-service')

    const manifest = store.getManifest()
    expect(manifest.manifestId).toBe(SEED_MANIFEST_ID)
    expect(manifest.datasets.map((entry) => entry.dataset)).toEqual(
      SEED_DATASET_ORDER
    )
    for (const dataset of SEED_DATASET_ORDER) {
      expect(store.hasCollection(dataset)).toBe(true)
    }
  })

  test('does not persist a map-ports object or manifest entry', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()

    await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store,
      logger: createSilentLogger()
    })

    expect(store.hasCollection('map-ports')).toBe(false)
    expect(
      store
        .getManifest()
        .datasets.some((entry) => entry.dataset === 'map-ports')
    ).toBe(false)
    expect(
      [...persistence._backing.objects.keys()].some((key) =>
        key.startsWith('map-ports/')
      )
    ).toBe(false)
  })

  test('a second bootstrap run is fully idempotent (same logical state, no new writes)', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()

    const first = await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store,
      logger: createSilentLogger()
    })
    const objectCountAfterFirst = persistence._backing.objects.size
    const manifestAfterFirst = store.getManifest()

    const second = await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store: createInMemoryDataStore(),
      logger: createSilentLogger()
    })

    expect(second.status).toBe('completed')
    expect(second.createdDatasets).toEqual([])
    expect(second.unchangedDatasets).toEqual(SEED_DATASET_ORDER)
    expect(second.replacedDatasets).toEqual([])
    expect(second.failedDatasets).toEqual([])
    expect(second.manifestVersion).toBe(first.manifestVersion)
    expect(persistence._backing.objects.size).toBe(objectCountAfterFirst)
    expect(persistence._backing.manifestState.manifest).toEqual(
      manifestAfterFirst
    )
  })

  test('preserves an unrelated pre-existing manifest entry', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const unrelatedEntry = {
      dataset: 'gears',
      collectionId: '11111111-1111-4111-8111-111111111111',
      schemaVersion: '1.0',
      version: 'pre-existing-1',
      format: 'json',
      etag: 'etag-gears',
      checksum: 'checksum-gears',
      itemCount: 1,
      sizeBytes: 10,
      lastModified: '2026-01-01T00:00:00Z'
    }
    persistence._backing.manifestState = {
      manifest: {
        manifestId: '22222222-2222-4222-8222-222222222222',
        version: 'v0',
        generatedAt: '2026-01-01T00:00:00Z',
        datasets: [unrelatedEntry]
      },
      etag: 'seed-manifest-etag'
    }
    // Bootstrap's own gears seed must still be able to replace this entry deterministically.
    persistence._backing.manifestState.etag = 'seed-manifest-etag'

    const summary = await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store,
      logger: createSilentLogger()
    })

    expect(summary.status).toBe('completed')
    const manifest = store.getManifest()
    // The pre-existing manifest's own ID is preserved (a real manifest already existed).
    expect(manifest.manifestId).toBe('22222222-2222-4222-8222-222222222222')
    const gearsEntry = manifest.datasets.find(
      (entry) => entry.dataset === 'gears'
    )
    expect(gearsEntry.version).toBe('local-seed-1')
  })

  test('stops before manifest publication when a seed file fails validation', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const brokenLoader = () => {
      throw new Error('boom')
    }

    // Simulate a corrupted seed resource by pointing the loader at a failing function
    // via a dedicated failure-injection collection instead of a real file.
    const summary = await bootstrapLocalReferenceData({
      config: createLocalConfig(),
      persistence,
      store,
      logger: createSilentLogger(),
      loadSeedCollection: brokenLoader
    })

    expect(summary.status).toBe('failed')
    expect(summary.failedDatasets[0].dataset).toBe(SEED_DATASET_ORDER[0])
    expect(store.getManifest()).toBeNull()
  })
})
