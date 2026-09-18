// Step 27: minimal Floci integration proof that the REAL Cache Refresh Module (not a
// hand-rolled loop) can hydrate an isolated In-Memory Data Store from the local S3-
// compatible endpoint. Requires `npm run floci:up` first; self-skips when Floci is
// unreachable so `npm test` never depends on Docker. Run explicitly with
// `npm run test:floci`.

import { beforeAll, describe, expect, test } from 'vitest'

import { createReferenceDataRepository } from '#/reference-data/persistence/reference-data-repository.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { createCacheRefreshService } from '#/reference-data/cache-refresh/cache-refresh-service.js'
import { validateManifest } from '#/reference-data/cache-refresh/manifest-validation.js'
import {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_TIMESTAMP
} from '#/reference-data/command/bootstrap-local-reference-data.js'
import { SEED_DATASET_ORDER } from '#/reference-data/command/seed-loader.js'
import { DATASETS } from '#/common/domain/datasets.js'

const FLOCI_HEALTH_URL = 'http://localhost:4566/_floci/health'
const BUCKET = 'mmo-cr-reference-data-service'

const LOCAL_CONFIG = {
  get: (key) =>
    ({
      cdpEnvironment: 'local',
      'aws.endpointUrl': 'http://localhost:4566',
      'referenceData.bucket': BUCKET
    })[key]
}

const SILENT_LOGGER = { info: () => {}, error: () => {}, warn: () => {} }

let floccyAvailable = false

try {
  const response = await fetch(FLOCI_HEALTH_URL, {
    signal: AbortSignal.timeout(1000)
  })
  floccyAvailable = response.ok
} catch {
  floccyAvailable = false
}

describe.skipIf(!floccyAvailable)(
  '#createCacheRefreshService hydrate (Floci integration)',
  () => {
    const persistence = createReferenceDataRepository({
      region: 'eu-west-2',
      endpointUrl: 'http://localhost:4566',
      forcePathStyle: true,
      bucket: BUCKET
    })

    beforeAll(async () => {
      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)

      // Guarantee a valid, seeded active manifest exists — reuses the existing,
      // already-tested idempotent Step 23 provisioning rather than a second
      // bootstrap mechanism (same pattern as the sibling bootstrap Floci suite).
      // Only (re-)bootstraps when no valid manifest yet covers every mandatory
      // dataset — an already-complete manifest may have since been replaced (e.g.
      // by the replace-collection Floci suite) with a non-seed active version,
      // and re-running bootstrap against that would collide with the original
      // immutable seed object still sitting at the fixed seed version.
      const hasValidCompleteManifest = async () => {
        try {
          const { manifest } = await persistence.readManifest()
          if (!validateManifest(manifest).valid) {
            return false
          }
          return SEED_DATASET_ORDER.every((dataset) =>
            manifest.datasets.some((entry) => entry.dataset === dataset)
          )
        } catch {
          return false
        }
      }
      if (!(await hasValidCompleteManifest())) {
        await persistence.writeManifest({
          manifest: {
            manifestId: SEED_MANIFEST_ID,
            version: 'reset-baseline',
            generatedAt: SEED_TIMESTAMP,
            datasets: []
          }
        })
        const summary = await bootstrapLocalReferenceData({
          config: LOCAL_CONFIG,
          persistence,
          store: createInMemoryDataStore(),
          logger: SILENT_LOGGER
        })
        expect(summary.status).toBe('completed')
      }
    })

    test('the real Cache Refresh Module hydrates an isolated store and becomes ready', async () => {
      const store = createInMemoryDataStore()
      const cacheRefresh = createCacheRefreshService({
        persistence,
        store,
        mandatoryDatasets: SEED_DATASET_ORDER,
        hydrationTimeoutMs: 5000,
        refreshConcurrency: 3,
        logger: SILENT_LOGGER
      })

      const result = await cacheRefresh.hydrate()

      expect(result.status).toBe('completed')
      expect(cacheRefresh.getReadinessState().ready).toBe(true)
      for (const dataset of SEED_DATASET_ORDER) {
        expect(store.hasCollection(dataset)).toBe(true)
      }
    })

    test('hydrated ports and map-statistical-areas preserve GUIDs separately from business codes', async () => {
      const store = createInMemoryDataStore()
      const cacheRefresh = createCacheRefreshService({
        persistence,
        store,
        mandatoryDatasets: SEED_DATASET_ORDER,
        hydrationTimeoutMs: 5000,
        refreshConcurrency: 3,
        logger: SILENT_LOGGER
      })
      await cacheRefresh.hydrate()

      const ports = store.getCollection(DATASETS.PORTS)
      expect(ports.items.length).toBeGreaterThan(0)
      for (const port of ports.items) {
        expect(port.id).toMatch(/^[0-9a-f-]{36}$/i)
        expect(port.code).not.toBe(port.id)
      }

      const statisticalAreas = store.getCollection(
        DATASETS.MAP_STATISTICAL_AREAS
      )
      expect(statisticalAreas.type).toBe('FeatureCollection')
      expect(statisticalAreas.features.length).toBeGreaterThan(0)
      for (const feature of statisticalAreas.features) {
        expect(feature.id).toMatch(/^[0-9a-f-]{36}$/i)
        expect(feature.properties.code).not.toBe(feature.id)
      }
    })
  }
)
