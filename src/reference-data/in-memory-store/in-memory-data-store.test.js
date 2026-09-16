import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from './in-memory-data-store.js'
import { DATASETS } from '#/common/domain/datasets.js'

const VESSEL_ITEM_COUNT = 2

function buildCollection() {
  return { items: [{ id: 'v-1' }, { id: 'v-2' }], nested: { tags: ['a', 'b'] } }
}

function buildMetadata(dataset, overrides = {}) {
  return {
    dataset,
    collectionId: 'collection-1',
    schemaVersion: '1.0',
    collectionVersion: '2024-01-01T00-00-00Z',
    format: 'json',
    itemCount: VESSEL_ITEM_COUNT,
    etag: '"etag-1"',
    checksum: 'checksum-1',
    sizeBytes: 100,
    lastModifiedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

function buildManifest(overrides = {}) {
  return {
    manifestId: 'manifest-1',
    manifestVersion: '1',
    generatedAt: '2024-01-01T00:00:00.000Z',
    datasets: [],
    ...overrides
  }
}

function buildUncloneableValue() {
  return { handler: () => {} }
}

describe('#createInMemoryDataStore construction', () => {
  test('a new store has no loaded datasets', () => {
    const store = createInMemoryDataStore()
    expect(store.listLoadedDatasets()).toEqual([])
  })

  test('a new store has no active manifest', () => {
    const store = createInMemoryDataStore()
    expect(store.getManifest()).toBeNull()
  })

  test('two store instances do not share state', () => {
    const storeA = createInMemoryDataStore()
    const storeB = createInMemoryDataStore()

    storeA.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    expect(storeB.hasCollection(DATASETS.VESSELS)).toBe(false)
  })
})

describe('#setCollection and #getCollection', () => {
  test('a supported canonical collection and metadata can be stored and retrieved', () => {
    const store = createInMemoryDataStore()
    const collection = buildCollection()
    const metadata = buildMetadata(DATASETS.VESSELS)

    store.setCollection(DATASETS.VESSELS, collection, metadata)

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(collection)
    expect(store.getCollectionMetadata(DATASETS.VESSELS)).toEqual(metadata)
  })

  test('an empty valid collection is still considered loaded', () => {
    const store = createInMemoryDataStore()
    store.setCollection(DATASETS.PORTS, [], buildMetadata(DATASETS.PORTS))

    expect(store.hasCollection(DATASETS.PORTS)).toBe(true)
    expect(store.getCollection(DATASETS.PORTS)).toEqual([])
  })

  test('an unsupported dataset is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() =>
      store.setCollection(
        'unsupported',
        buildCollection(),
        buildMetadata('unsupported')
      )
    ).toThrow(/Unsupported dataset/)
  })

  test('map-ports cannot be stored independently', () => {
    const store = createInMemoryDataStore()
    expect(() =>
      store.setCollection(
        DATASETS.MAP_PORTS,
        buildCollection(),
        buildMetadata(DATASETS.MAP_PORTS)
      )
    ).toThrow(/derived/)
  })

  test('a missing collection or metadata argument is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() =>
      store.setCollection(
        DATASETS.VESSELS,
        undefined,
        buildMetadata(DATASETS.VESSELS)
      )
    ).toThrow(/required/)
    expect(() =>
      store.setCollection(DATASETS.VESSELS, buildCollection(), undefined)
    ).toThrow(/required/)
  })

  test('metadata for a different dataset is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() =>
      store.setCollection(
        DATASETS.VESSELS,
        buildCollection(),
        buildMetadata(DATASETS.GEARS)
      )
    ).toThrow(/does not match/)
  })

  test('storing one dataset does not affect another', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    expect(store.hasCollection(DATASETS.GEARS)).toBe(false)
    expect(store.getCollection(DATASETS.GEARS)).toBeUndefined()
  })
})

describe('#hasCollection', () => {
  test('an unloaded supported dataset reports false', () => {
    const store = createInMemoryDataStore()
    expect(store.hasCollection(DATASETS.VESSELS)).toBe(false)
  })

  test('a loaded dataset reports true', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    expect(store.hasCollection(DATASETS.VESSELS)).toBe(true)
  })

  test('a loaded empty collection reports true', () => {
    const store = createInMemoryDataStore()
    store.setCollection(DATASETS.PORTS, {}, buildMetadata(DATASETS.PORTS))
    expect(store.hasCollection(DATASETS.PORTS)).toBe(true)
  })

  test('an unsupported dataset is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() => store.hasCollection('unsupported')).toThrow(
      /Unsupported dataset/
    )
  })
})

describe('#atomic replacement', () => {
  test('a collection can be replaced', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v1' })
    )

    const replacement = { items: [{ id: 'v-3' }] }
    store.setCollection(
      DATASETS.VESSELS,
      replacement,
      buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v2' })
    )

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(replacement)
    expect(
      store.getCollectionMetadata(DATASETS.VESSELS).collectionVersion
    ).toBe('v2')
  })

  test('replacement of one dataset does not affect another', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    store.setCollection(
      DATASETS.GEARS,
      buildCollection(),
      buildMetadata(DATASETS.GEARS)
    )

    store.setCollection(
      DATASETS.VESSELS,
      { items: [] },
      buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v2' })
    )

    expect(store.getCollectionMetadata(DATASETS.GEARS).collectionVersion).toBe(
      buildMetadata(DATASETS.GEARS).collectionVersion
    )
  })

  test('a failure while preparing replacement data preserves the previous collection', () => {
    const store = createInMemoryDataStore()
    const originalCollection = buildCollection()
    const originalMetadata = buildMetadata(DATASETS.VESSELS)
    store.setCollection(DATASETS.VESSELS, originalCollection, originalMetadata)

    expect(() =>
      store.setCollection(
        DATASETS.VESSELS,
        buildUncloneableValue(),
        buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v2' })
      )
    ).toThrow(/not cloneable/)

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(originalCollection)
    expect(store.getCollectionMetadata(DATASETS.VESSELS)).toEqual(
      originalMetadata
    )
  })

  test('readers never observe mismatched collection and metadata', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v1' })
    )
    store.setCollection(
      DATASETS.VESSELS,
      { items: [{ id: 'v-9' }] },
      buildMetadata(DATASETS.VESSELS, { collectionVersion: 'v2' })
    )

    expect(store.getCollection(DATASETS.VESSELS)).toEqual({
      items: [{ id: 'v-9' }]
    })
    expect(
      store.getCollectionMetadata(DATASETS.VESSELS).collectionVersion
    ).toBe('v2')
  })
})

describe('#removeCollection', () => {
  test('removing a loaded dataset removes its collection and metadata', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    expect(store.removeCollection(DATASETS.VESSELS)).toBe(true)
    expect(store.hasCollection(DATASETS.VESSELS)).toBe(false)
    expect(store.getCollection(DATASETS.VESSELS)).toBeUndefined()
    expect(store.getCollectionMetadata(DATASETS.VESSELS)).toBeUndefined()
  })

  test('removing one dataset does not affect another', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    store.setCollection(
      DATASETS.GEARS,
      buildCollection(),
      buildMetadata(DATASETS.GEARS)
    )

    store.removeCollection(DATASETS.VESSELS)

    expect(store.hasCollection(DATASETS.GEARS)).toBe(true)
  })

  test('removing an unloaded supported dataset is deterministic', () => {
    const store = createInMemoryDataStore()
    expect(store.removeCollection(DATASETS.VESSELS)).toBe(false)
  })

  test('removing an unsupported dataset is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() => store.removeCollection('unsupported')).toThrow(
      /Unsupported dataset/
    )
  })
})

describe('#manifest', () => {
  test('a manifest can be stored and retrieved', () => {
    const store = createInMemoryDataStore()
    const manifest = buildManifest()
    store.setManifest(manifest)

    expect(store.getManifest()).toEqual(manifest)
  })

  test('replacing the manifest replaces it completely', () => {
    const store = createInMemoryDataStore()
    store.setManifest(buildManifest({ manifestVersion: '1' }))
    store.setManifest(buildManifest({ manifestVersion: '2', extra: 'field' }))

    expect(store.getManifest()).toEqual(
      buildManifest({ manifestVersion: '2', extra: 'field' })
    )
  })

  test('the no-manifest state is deterministic', () => {
    const store = createInMemoryDataStore()
    expect(store.getManifest()).toBeNull()
  })

  test('a missing manifest argument is rejected', () => {
    const store = createInMemoryDataStore()
    expect(() => store.setManifest(undefined)).toThrow(/required/)
  })

  test('collection operations do not unintentionally modify the manifest', () => {
    const store = createInMemoryDataStore()
    store.setManifest(buildManifest())
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    expect(store.getManifest()).toEqual(buildManifest())
  })

  test('manifest operations do not unintentionally modify collections', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    store.setManifest(buildManifest())

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(buildCollection())
  })
})

describe('#listLoadedDatasets', () => {
  test('no datasets are returned for a new store', () => {
    const store = createInMemoryDataStore()
    expect(store.listLoadedDatasets()).toEqual([])
  })

  test('only loaded datasets are returned', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.PORTS,
      buildCollection(),
      buildMetadata(DATASETS.PORTS)
    )

    expect(store.listLoadedDatasets()).toEqual([DATASETS.PORTS])
  })

  test('removed datasets no longer appear', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.PORTS,
      buildCollection(),
      buildMetadata(DATASETS.PORTS)
    )
    store.removeCollection(DATASETS.PORTS)

    expect(store.listLoadedDatasets()).toEqual([])
  })

  test('results use the stable canonical dataset order regardless of insertion order', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.SPECIES,
      buildCollection(),
      buildMetadata(DATASETS.SPECIES)
    )
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    expect(store.listLoadedDatasets()).toEqual([
      DATASETS.VESSELS,
      DATASETS.SPECIES
    ])
  })
})

describe('#clear', () => {
  test('clear removes all collections, metadata, and the manifest, leaving the store reusable', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    store.setManifest(buildManifest())

    store.clear()

    expect(store.listLoadedDatasets()).toEqual([])
    expect(store.getCollection(DATASETS.VESSELS)).toBeUndefined()
    expect(store.getManifest()).toBeNull()

    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    expect(store.hasCollection(DATASETS.VESSELS)).toBe(true)
  })

  test('clear does not affect another store instance', () => {
    const storeA = createInMemoryDataStore()
    const storeB = createInMemoryDataStore()
    storeA.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )
    storeB.setCollection(
      DATASETS.GEARS,
      buildCollection(),
      buildMetadata(DATASETS.GEARS)
    )

    storeA.clear()

    expect(storeB.hasCollection(DATASETS.GEARS)).toBe(true)
  })
})

describe('#defensive access', () => {
  test('mutating the original collection after storage does not modify stored data', () => {
    const store = createInMemoryDataStore()
    const collection = buildCollection()
    store.setCollection(
      DATASETS.VESSELS,
      collection,
      buildMetadata(DATASETS.VESSELS)
    )

    collection.items.push({ id: 'intruder' })
    collection.nested.tags.push('z')

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(buildCollection())
  })

  test('mutating the original metadata after storage does not modify stored metadata', () => {
    const store = createInMemoryDataStore()
    const metadata = buildMetadata(DATASETS.VESSELS)
    store.setCollection(DATASETS.VESSELS, buildCollection(), metadata)

    metadata.checksum = 'tampered'

    expect(store.getCollectionMetadata(DATASETS.VESSELS).checksum).toBe(
      'checksum-1'
    )
  })

  test('mutating the original manifest after storage does not modify the stored manifest', () => {
    const store = createInMemoryDataStore()
    const manifest = buildManifest()
    store.setManifest(manifest)

    manifest.datasets.push({ dataset: DATASETS.VESSELS })

    expect(store.getManifest().datasets).toEqual([])
  })

  test('mutating a retrieved collection does not modify subsequent reads', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    const retrieved = store.getCollection(DATASETS.VESSELS)
    retrieved.items.push({ id: 'intruder' })
    retrieved.nested.tags.push('z')

    expect(store.getCollection(DATASETS.VESSELS)).toEqual(buildCollection())
  })

  test('mutating retrieved metadata does not modify subsequent reads', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      DATASETS.VESSELS,
      buildCollection(),
      buildMetadata(DATASETS.VESSELS)
    )

    const retrieved = store.getCollectionMetadata(DATASETS.VESSELS)
    retrieved.checksum = 'tampered'

    expect(store.getCollectionMetadata(DATASETS.VESSELS).checksum).toBe(
      'checksum-1'
    )
  })

  test('mutating a retrieved manifest does not modify subsequent reads', () => {
    const store = createInMemoryDataStore()
    store.setManifest(buildManifest())

    const retrieved = store.getManifest()
    retrieved.datasets.push({ dataset: DATASETS.VESSELS })

    expect(store.getManifest().datasets).toEqual([])
  })
})
