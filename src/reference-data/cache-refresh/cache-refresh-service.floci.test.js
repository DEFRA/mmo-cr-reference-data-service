// Step 27: minimal Floci integration proof that the REAL Cache Refresh Module (not a
// hand-rolled loop) can hydrate an isolated In-Memory Data Store from the local S3-
// compatible endpoint. Requires `npm run floci:up` first; self-skips when Floci is
// unreachable so `npm test` never depends on Docker. Run explicitly with
// `npm run test:floci`.

import { beforeAll, describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { createCacheRefreshService } from '#/reference-data/cache-refresh/cache-refresh-service.js'
import { SEED_DATASET_ORDER } from '#/reference-data/command/seed-loader.js'
import { DATASETS } from '#/common/domain/datasets.js'
import {
  FLOCI_HEALTH_URL,
  SILENT_LOGGER,
  createFlociRepository,
  ensureSeededManifest,
  isFlociAvailable
} from '#/reference-data/floci-test-helpers.js'

const floccyAvailable = await isFlociAvailable()

describe.skipIf(!floccyAvailable)(
  '#createCacheRefreshService hydrate (Floci integration)',
  () => {
    const persistence = createFlociRepository()

    beforeAll(async () => {
      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)

      await ensureSeededManifest(persistence)
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
