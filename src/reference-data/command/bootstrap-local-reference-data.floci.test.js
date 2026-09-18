// Floci integration test for the Step 23 local bootstrap: verifies the deterministic
// seed workflow against the real S3-compatible endpoint. Requires `npm run floci:up`
// first; self-skips when Floci is unreachable so `npm test` never depends on Docker.
// Run explicitly with `npm run test:floci`.

import { beforeAll, describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_TIMESTAMP
} from './bootstrap-local-reference-data.js'
import { SEED_DATASET_ORDER } from './seed-loader.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { validateManifest } from '#/reference-data/cache-refresh/manifest-validation.js'
import {
  FLOCI_HEALTH_URL,
  LOCAL_CONFIG,
  SILENT_LOGGER,
  createFlociRepository,
  isFlociAvailable
} from '#/reference-data/floci-test-helpers.js'

const floccyAvailable = await isFlociAvailable()

describe.skipIf(!floccyAvailable)(
  '#bootstrapLocalReferenceData (Floci integration)',
  () => {
    const persistence = createFlociRepository()

    beforeAll(async () => {
      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)

      // Only initialise a fresh empty manifest when none exists yet or the current one
      // is structurally broken (e.g. left behind by an unrelated local experiment).
      // Never discard an already-valid manifest: repeated runs of this suite against a
      // bucket that already has our own seed data active must stay purely idempotent,
      // and any genuinely unrelated dataset entries must be preserved, not wiped.
      const isValidActiveManifest = async () => {
        try {
          const { manifest } = await persistence.readManifest()
          return validateManifest(manifest).valid
        } catch {
          return false
        }
      }

      if (!(await isValidActiveManifest())) {
        await persistence.writeManifest({
          manifest: {
            manifestId: SEED_MANIFEST_ID,
            version: 'reset-baseline',
            generatedAt: SEED_TIMESTAMP,
            datasets: []
          }
        })
      }
    })

    test('bootstraps all six maintained datasets and activates the manifest last', async () => {
      const summary = await bootstrapLocalReferenceData({
        config: LOCAL_CONFIG,
        persistence,
        store: createInMemoryDataStore(),
        logger: SILENT_LOGGER
      })

      expect(summary.status).toBe('completed')
      expect(summary.failedDatasets).toEqual([])
      expect(
        [...summary.createdDatasets, ...summary.unchangedDatasets].sort()
      ).toEqual([...SEED_DATASET_ORDER].sort())

      const { manifest } = await persistence.readManifest()
      expect(manifest.manifestId).toBe(SEED_MANIFEST_ID)
      const datasetNames = manifest.datasets.map((entry) => entry.dataset)
      for (const dataset of SEED_DATASET_ORDER) {
        expect(datasetNames).toContain(dataset)
      }
      expect(datasetNames).not.toContain(DATASETS.MAP_PORTS)
    })

    test('every manifest object key can be read back and deserialises correctly', async () => {
      const { manifest } = await persistence.readManifest()

      for (const entry of manifest.datasets) {
        const { content } = await persistence.readCollection({
          dataset: entry.dataset,
          collectionVersion: entry.version
        })
        expect(content.dataset).toBe(entry.dataset)
        expect(content.collectionId).toBe(entry.collectionId)
      }
    })

    test('a second bootstrap execution is idempotent', async () => {
      const summary = await bootstrapLocalReferenceData({
        config: LOCAL_CONFIG,
        persistence,
        store: createInMemoryDataStore(),
        logger: SILENT_LOGGER
      })

      expect(summary.status).toBe('completed')
      expect(summary.createdDatasets).toEqual([])
      expect(summary.replacedDatasets).toEqual([])
      expect([...summary.unchangedDatasets].sort()).toEqual(
        [...SEED_DATASET_ORDER].sort()
      )
    })

    test('startup hydration can load the seeded active manifest and collections', async () => {
      const store = createInMemoryDataStore()
      const { manifest } = await persistence.readManifest()

      for (const entry of manifest.datasets) {
        const { content } = await persistence.readCollection({
          dataset: entry.dataset,
          collectionVersion: entry.version
        })
        store.setCollection(entry.dataset, content, entry)
      }
      store.setManifest(manifest)

      for (const dataset of SEED_DATASET_ORDER) {
        expect(store.hasCollection(dataset)).toBe(true)
      }
    })
  }
)
