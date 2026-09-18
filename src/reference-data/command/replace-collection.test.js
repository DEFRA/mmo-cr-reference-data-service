import { describe, expect, test } from 'vitest'

import { replaceCollection } from './replace-collection.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import { calculateDeterministicEtag } from '#/reference-data/query/result-etag.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

function createFakePersistence(
  backing = { objects: new Map(), manifestState: null, manifestCounter: 0 }
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
        etag: `sha256-${collectionVersion}`,
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
      backing.manifestCounter += 1
      const etag = `manifest-etag-${backing.manifestCounter}`
      backing.manifestState = { manifest, etag }
      return { etag }
    },
    _hasObject: (dataset, version) =>
      backing.objects.has(`${dataset}/${version}`),
    objectExists: async ({ manifest }) =>
      manifest ? backing.manifestState !== null : false,
    _backing: backing
  }
}

function createClock(times) {
  let index = 0
  return { now: () => times[Math.min(index++, times.length - 1)] }
}

describe('#replaceCollection', () => {
  test('activates the first version of a collection when none is active', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock: createClock(['2026-09-17T00:00:00Z'])
    })

    expect(result.outcome).toBe('activated')
    expect(result.previousCollection).toBeUndefined()
    expect(result.collection.version).toBe(validPortsCollection.version)
    expect(store.hasCollection('ports')).toBe(true)
    expect(store.getManifest().datasets).toHaveLength(1)
  })

  test('replaces an active collection with a new version and reports previous metadata', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z', '2026-09-18T00:00:00Z'])

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })

    const nextCollection = structuredClone(validPortsCollection)
    nextCollection.version = '2026.09.18.1'
    nextCollection.items[0].name = 'Plymouth Updated'

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: nextCollection,
      collectionVersion: nextCollection.version,
      persistence,
      store,
      clock
    })

    expect(result.outcome).toBe('activated')
    expect(result.previousCollection.version).toBe(validPortsCollection.version)
    expect(result.collection.version).toBe('2026.09.18.1')
    expect(store.getCollection('ports').items[0].name).toBe('Plymouth Updated')
  })

  test('preserves unrelated manifest entries when replacing one dataset', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z'])

    store.setManifest({
      manifestId: '22222222-2222-4222-8222-222222222222',
      version: 'v0',
      generatedAt: '2026-09-01T00:00:00Z',
      datasets: [
        {
          dataset: 'gears',
          collectionId: '11111111-1111-4111-8111-111111111111',
          schemaVersion: '1.0',
          version: '2026.01.01.1',
          format: 'json',
          etag: 'etag-gears',
          checksum: 'checksum-gears',
          itemCount: 1,
          sizeBytes: 10,
          lastModified: '2026-01-01T00:00:00Z'
        }
      ]
    })
    // Seed persistence with the same manifest so writeManifest's precondition matches.
    await persistence.writeManifest({ manifest: store.getManifest() })

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })

    expect(result.outcome).toBe('activated')
    const datasets = store.getManifest().datasets.map((entry) => entry.dataset)
    expect(datasets).toContain('gears')
    expect(datasets).toContain('ports')
  })

  test('returns an idempotent result for a replay of the active version with the same content', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z'])

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })
    const manifestBefore = store.getManifest()

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })

    expect(result.outcome).toBe('idempotent')
    expect(store.getManifest()).toEqual(manifestBefore)
  })

  test('rejects the same version with different content', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z'])

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })

    const differentContent = structuredClone(validPortsCollection)
    differentContent.items[0].name = 'Changed Name'

    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: differentContent,
        collectionVersion: validPortsCollection.version,
        persistence,
        store,
        clock
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('rejects a stale If-Match against the active collection', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z', '2026-09-18T00:00:00Z'])

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })

    const nextCollection = structuredClone(validPortsCollection)
    nextCollection.version = '2026.09.18.1'

    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: nextCollection,
        collectionVersion: nextCollection.version,
        ifMatch: '"sha256-stale"',
        persistence,
        store,
        clock
      })
    ).rejects.toMatchObject({ code: 'collection_modified' })
  })

  test('accepts a matching If-Match against the active collection', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const clock = createClock(['2026-09-17T00:00:00Z', '2026-09-18T00:00:00Z'])

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock
    })
    const activeMetadata = store.getCollectionMetadata('ports')
    const currentEtag = calculateDeterministicEtag({
      collectionId: activeMetadata.collectionId,
      version: activeMetadata.version
    })

    const nextCollection = structuredClone(validPortsCollection)
    nextCollection.version = '2026.09.18.1'

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: nextCollection,
      collectionVersion: nextCollection.version,
      ifMatch: currentEtag,
      persistence,
      store,
      clock
    })

    expect(result.outcome).toBe('activated')
  })

  test('rejects If-Match when no active collection exists yet', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()

    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: validPortsCollection,
        collectionVersion: validPortsCollection.version,
        ifMatch: '"sha256-anything"',
        persistence,
        store,
        clock: createClock(['2026-09-17T00:00:00Z'])
      })
    ).rejects.toMatchObject({ code: 'collection_modified' })
  })

  test('returns an invalid outcome without writing anything for a business-invalid collection', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    const result = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: duplicated,
      collectionVersion: duplicated.version,
      persistence,
      store,
      clock: createClock(['2026-09-17T00:00:00Z'])
    })

    expect(result.outcome).toBe('invalid')
    expect(store.hasCollection('ports')).toBe(false)
    expect(persistence._hasObject('ports', duplicated.version)).toBe(false)
  })

  test('a concurrent manifest activation causes the losing writer to fail', async () => {
    const backing = {
      objects: new Map(),
      manifestState: null,
      manifestCounter: 0
    }
    const persistence = createFakePersistence(backing)
    const storeA = createInMemoryDataStore()
    const storeB = createInMemoryDataStore()

    const collectionA = structuredClone(validPortsCollection)
    collectionA.version = '2026.09.17.1'
    const collectionB = structuredClone(validPortsCollection)
    collectionB.version = '2026.09.17.2'

    // Writer B "reads" the manifest before Writer A activates (captured snapshot: none yet).
    const staleReadPersistence = {
      ...persistence,
      readManifest: async () => {
        const error = new Error('no active manifest')
        error.code = 'dataset_not_found'
        throw error
      }
    }

    const resultA = await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: collectionA,
      collectionVersion: collectionA.version,
      persistence,
      store: storeA,
      clock: createClock(['2026-09-17T00:00:00Z'])
    })
    expect(resultA.outcome).toBe('activated')

    // Writer B still writes through the real (shared) persistence, but believed there
    // was no active manifest when it started — its conditional manifest write must now
    // fail because the manifest has since changed.
    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: collectionB,
        collectionVersion: collectionB.version,
        persistence: {
          ...persistence,
          readManifest: staleReadPersistence.readManifest,
          writeManifest: persistence.writeManifest
        },
        store: storeB,
        clock: createClock(['2026-09-17T00:00:01Z'])
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('does not mutate the supplied collection', async () => {
    const persistence = createFakePersistence()
    const store = createInMemoryDataStore()
    const before = structuredClone(validPortsCollection)

    await replaceCollection({
      dataset: 'ports',
      schemaVersion: '1.0',
      collection: validPortsCollection,
      collectionVersion: validPortsCollection.version,
      persistence,
      store,
      clock: createClock(['2026-09-17T00:00:00Z'])
    })

    expect(validPortsCollection).toEqual(before)
  })

  test('propagates an unexpected manifest-read failure unrelated to a missing manifest', async () => {
    const persistence = {
      ...createFakePersistence(),
      readManifest: async () => {
        throw new Error('S3 unavailable')
      }
    }
    const store = createInMemoryDataStore()

    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: validPortsCollection,
        collectionVersion: validPortsCollection.version,
        persistence,
        store,
        clock: createClock(['2026-09-17T00:00:00Z'])
      })
    ).rejects.toThrow('S3 unavailable')
  })

  test('surfaces a partial-failure error when in-memory publication fails after persistence succeeded', async () => {
    const persistence = createFakePersistence()
    const store = {
      ...createInMemoryDataStore(),
      setCollection: () => {
        throw new Error('store full')
      }
    }

    await expect(
      replaceCollection({
        dataset: 'ports',
        schemaVersion: '1.0',
        collection: validPortsCollection,
        collectionVersion: validPortsCollection.version,
        persistence,
        store,
        clock: createClock(['2026-09-17T00:00:00Z'])
      })
    ).rejects.toMatchObject({
      code: 'internal_error',
      dataset: 'ports',
      retryable: true,
      partialFailure: true
    })
  })
})
