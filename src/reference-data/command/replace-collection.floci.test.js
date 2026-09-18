// Step 27: minimal Floci integration proof of the atomic full-replacement workflow
// (Step 22 `replaceCollection`) against the real S3-compatible endpoint — persisted
// activation, read-API-visible state, restart hydration, stale-manifest conflict, and
// failed-activation safety. Requires `npm run floci:up` first; self-skips when Floci
// is unreachable so `npm test` never depends on Docker. Run explicitly with
// `npm run test:floci`.
//
// Deviation note (documented in the Step 27 plan): activation necessarily mutates the
// single shared `reference-data/manifest.json` object. Only `ports` is activated here
// (the prompt's own representative JSON dataset); collection objects are isolated via
// a per-run version prefix, and the suite re-activates the original seed `ports`
// content at the end so the bucket is left in a valid, seed-equivalent state.

import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, test } from 'vitest'

import { createReferenceDataRepository } from '#/reference-data/persistence/reference-data-repository.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { createCacheRefreshService } from '#/reference-data/cache-refresh/cache-refresh-service.js'
import { validateManifest } from '#/reference-data/cache-refresh/manifest-validation.js'
import { replaceCollection } from '#/reference-data/command/replace-collection.js'
import {
  bootstrapLocalReferenceData,
  SEED_MANIFEST_ID,
  SEED_TIMESTAMP
} from '#/reference-data/command/bootstrap-local-reference-data.js'
import {
  loadSeedCollection,
  SEED_DATASET_ORDER
} from '#/reference-data/command/seed-loader.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { createMapPortsQueryService } from '#/reference-data/query/map-ports-query-service.js'
import { portsQueryConfiguration } from '#/reference-data/query/ports-query-configuration.js'
import { calculateDeterministicEtag } from '#/reference-data/query/result-etag.js'
import { DATASETS } from '#/common/domain/datasets.js'

const FLOCI_HEALTH_URL = 'http://localhost:4566/_floci/health'
const BUCKET = 'mmo-cr-reference-data-service'
const TEST_RUN_PREFIX = `test-${randomUUID()}`
const HYDRATION_OPTIONS = {
  mandatoryDatasets: SEED_DATASET_ORDER,
  hydrationTimeoutMs: 5000,
  refreshConcurrency: 3
}

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

// Builds a full valid ports collection (whole-collection replacement, never an
// item-level patch) from the committed seed content plus the supplied overrides.
function buildPortsCollection({ version, items }) {
  const seedPorts = loadSeedCollection(DATASETS.PORTS)
  return {
    ...seedPorts,
    version,
    items: items ?? seedPorts.items
  }
}

function seedPortItems() {
  return loadSeedCollection(DATASETS.PORTS).items
}

async function hydrateFreshStore(persistence) {
  const store = createInMemoryDataStore()
  const cacheRefresh = createCacheRefreshService({
    persistence,
    store,
    ...HYDRATION_OPTIONS,
    logger: SILENT_LOGGER
  })
  const result = await cacheRefresh.hydrate()
  return { store, cacheRefresh, result }
}

describe.skipIf(!floccyAvailable)(
  '#replaceCollection atomic activation (Floci integration)',
  () => {
    const persistence = createReferenceDataRepository({
      region: 'eu-west-2',
      endpointUrl: 'http://localhost:4566',
      forcePathStyle: true,
      bucket: BUCKET
    })

    // Captured before any mutation in this suite, so the final restore test can
    // reactivate the EXACT prior manifest entry (no new object write, since the
    // fixed-version seed object key is immutable and can never be recreated).
    let originalPortsEntry

    beforeAll(async () => {
      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)

      // Only (re-)bootstraps when no valid manifest yet covers every mandatory
      // dataset — an already-complete manifest from an earlier Floci suite in
      // this same run may have a non-seed active ports version, and
      // unconditionally re-running bootstrap against that would collide with
      // the original immutable seed object still sitting at the fixed seed
      // version.
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

      const { manifest } = await persistence.readManifest()
      originalPortsEntry = manifest.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
    })

    test('an immutable ports write is not activated until the manifest is updated', async () => {
      const candidateVersion = `${TEST_RUN_PREFIX}-ports-candidate`
      const { manifest: before } = await persistence.readManifest()
      const activePortsEntryBefore = before.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )

      const writeResult = await persistence.writeCollection({
        dataset: DATASETS.PORTS,
        collectionVersion: candidateVersion,
        content: buildPortsCollection({ version: candidateVersion })
      })
      expect(writeResult.etag).toBeTruthy()

      const { content: readBack } = await persistence.readCollection({
        dataset: DATASETS.PORTS,
        collectionVersion: candidateVersion
      })
      expect(readBack.version).toBe(candidateVersion)

      const { manifest: after } = await persistence.readManifest()
      const activePortsEntryAfter = after.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
      expect(activePortsEntryAfter.version).toBe(activePortsEntryBefore.version)
    })

    test('replaceCollection activates a new ports version, leaving unrelated entries unchanged', async () => {
      const { manifest: beforeManifest } = await persistence.readManifest()
      const vesselsEntryBefore = beforeManifest.datasets.find(
        (entry) => entry.dataset === DATASETS.VESSELS
      )

      const replacementVersion = `${TEST_RUN_PREFIX}-ports-v1`
      const replacementItems = seedPortItems().map((item, index) =>
        index === 0 ? { ...item, name: 'Plymouth (Floci Step 27 test)' } : item
      )

      const result = await replaceCollection({
        dataset: DATASETS.PORTS,
        schemaVersion: '1.0',
        collection: buildPortsCollection({
          version: replacementVersion,
          items: replacementItems
        }),
        collectionVersion: replacementVersion,
        persistence,
        store: createInMemoryDataStore(),
        clock: { now: () => new Date().toISOString() }
      })

      expect(result.outcome).toBe('activated')
      expect(result.collection.version).toBe(replacementVersion)

      const { manifest: afterManifest } = await persistence.readManifest()
      const portsEntry = afterManifest.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
      expect(portsEntry.version).toBe(replacementVersion)

      const vesselsEntryAfter = afterManifest.datasets.find(
        (entry) => entry.dataset === DATASETS.VESSELS
      )
      expect(vesselsEntryAfter).toEqual(vesselsEntryBefore)
    })

    test('the read API reflects the replacement after activation (changed ETag, updated ports, derived map-ports)', async () => {
      const { store: storeBeforeActivation } =
        await hydrateFreshStore(persistence)
      const queryBefore = createCollectionQueryService({
        store: storeBeforeActivation
      })
      const etagBefore = queryBefore.queryCollection(
        portsQueryConfiguration,
        {}
      ).etag

      const replacementVersion = `${TEST_RUN_PREFIX}-ports-v2`
      const renamedPort = 'Plymouth (Floci Step 27 read-API test)'
      const replacementItems = seedPortItems().map((item, index) =>
        index === 0 ? { ...item, name: renamedPort } : item
      )
      await replaceCollection({
        dataset: DATASETS.PORTS,
        schemaVersion: '1.0',
        collection: buildPortsCollection({
          version: replacementVersion,
          items: replacementItems
        }),
        collectionVersion: replacementVersion,
        persistence,
        store: createInMemoryDataStore(),
        clock: { now: () => new Date().toISOString() }
      })

      const { store } = await hydrateFreshStore(persistence)
      const query = createCollectionQueryService({ store })
      const afterResult = query.queryCollection(portsQueryConfiguration, {})

      expect(afterResult.etag).not.toBe(etagBefore)
      expect(afterResult.items.some((port) => port.name === renamedPort)).toBe(
        true
      )

      const mapPorts = createMapPortsQueryService({ store }).getMapPorts()
      expect(
        mapPorts.body.features.some(
          (feature) => feature.properties.name === renamedPort
        )
      ).toBe(true)
    })

    test('restart hydration loads the persisted replacement rather than reverting', async () => {
      const { manifest } = await persistence.readManifest()
      const activePortsEntry = manifest.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )

      const { store, result } = await hydrateFreshStore(persistence)

      expect(result.status).toBe('completed')
      expect(store.getCollectionMetadata(DATASETS.PORTS).version).toBe(
        activePortsEntry.version
      )
      expect(activePortsEntry.version).toContain(TEST_RUN_PREFIX)
    })

    test('a stale manifest ETag is rejected and the active collection remains unchanged', async () => {
      const { manifest: staleManifest } = await persistence.readManifest()
      const staleActivePortsEntry = staleManifest.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
      const staleIfMatch = calculateDeterministicEtag({
        collectionId: staleActivePortsEntry.collectionId,
        version: staleActivePortsEntry.version
      })

      // Advance the real active manifest past the captured snapshot, so the captured
      // ETag above is now provably stale.
      const intermediateVersion = `${TEST_RUN_PREFIX}-ports-v3`
      await replaceCollection({
        dataset: DATASETS.PORTS,
        schemaVersion: '1.0',
        collection: buildPortsCollection({ version: intermediateVersion }),
        collectionVersion: intermediateVersion,
        persistence,
        store: createInMemoryDataStore(),
        clock: { now: () => new Date().toISOString() }
      })

      const staleAttemptVersion = `${TEST_RUN_PREFIX}-ports-stale-attempt`
      await expect(
        replaceCollection({
          dataset: DATASETS.PORTS,
          schemaVersion: '1.0',
          collection: buildPortsCollection({ version: staleAttemptVersion }),
          collectionVersion: staleAttemptVersion,
          ifMatch: staleIfMatch,
          persistence,
          store: createInMemoryDataStore(),
          clock: { now: () => new Date().toISOString() }
        })
      ).rejects.toMatchObject({ code: 'collection_modified' })

      const { manifest: afterConflict } = await persistence.readManifest()
      const portsEntryAfterConflict = afterConflict.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
      expect(portsEntryAfterConflict.version).toBe(intermediateVersion)
    })

    test('a failure between the immutable write and manifest activation leaves the previous manifest active', async () => {
      const { manifest: beforeManifest } = await persistence.readManifest()
      const activePortsEntryBefore = beforeManifest.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )

      const failingVersion = `${TEST_RUN_PREFIX}-ports-failed-activation`
      const persistenceWithFailingManifestWrite = {
        ...persistence,
        writeManifest: async () => {
          throw new Error('simulated manifest-activation failure')
        }
      }

      await expect(
        replaceCollection({
          dataset: DATASETS.PORTS,
          schemaVersion: '1.0',
          collection: buildPortsCollection({ version: failingVersion }),
          collectionVersion: failingVersion,
          persistence: persistenceWithFailingManifestWrite,
          store: createInMemoryDataStore(),
          clock: { now: () => new Date().toISOString() }
        })
      ).rejects.toThrow('simulated manifest-activation failure')

      // The candidate object was written (real persistence.writeCollection ran), but
      // is not referenced by any manifest entry, so it is never treated as active.
      const { content: orphanedCandidate } = await persistence.readCollection({
        dataset: DATASETS.PORTS,
        collectionVersion: failingVersion
      })
      expect(orphanedCandidate.version).toBe(failingVersion)

      const { manifest: afterFailure } = await persistence.readManifest()
      const activePortsEntryAfter = afterFailure.datasets.find(
        (entry) => entry.dataset === DATASETS.PORTS
      )
      expect(activePortsEntryAfter.version).toBe(activePortsEntryBefore.version)

      const { store, result } = await hydrateFreshStore(persistence)
      expect(result.status).toBe('completed')
      expect(store.getCollectionMetadata(DATASETS.PORTS).version).toBe(
        activePortsEntryBefore.version
      )

      const otherDatasets = SEED_DATASET_ORDER.filter(
        (dataset) => dataset !== DATASETS.PORTS
      )
      for (const dataset of otherDatasets) {
        expect(store.hasCollection(dataset)).toBe(true)
      }
    })

    // The immutable seed collection object is never deleted by any test above — only
    // the manifest's active pointer moves. Restoring is therefore a direct manifest
    // write pointing back at the untouched original entry (never a new collection
    // version), so any other Floci suite's bootstrap idempotency check still sees the
    // fixed seed version as active, regardless of test-file execution order.
    test('reactivates the original ports manifest entry, restoring the exact prior active state', async () => {
      const { manifest: current, metadata } = await persistence.readManifest()
      const restoredManifest = {
        ...current,
        datasets: current.datasets.map((entry) =>
          entry.dataset === DATASETS.PORTS ? originalPortsEntry : entry
        )
      }

      await persistence.writeManifest({
        manifest: restoredManifest,
        expectedEtag: metadata.etag
      })

      const { store } = await hydrateFreshStore(persistence)
      expect(store.getCollectionMetadata(DATASETS.PORTS).version).toBe(
        originalPortsEntry.version
      )
      const restoredPorts = store.getCollection(DATASETS.PORTS)
      expect(restoredPorts.items.map((item) => item.name)).toEqual(
        seedPortItems().map((item) => item.name)
      )
    })
  }
)
