import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { gearsQueryConfiguration } from './gears-query-configuration.js'

const COLLECTION = {
  categories: [{ id: 'cat-1', code: 'TRAWL', name: 'Trawls' }],
  characteristics: [
    {
      id: 'char-1',
      code: 'MESH_SIZE',
      name: 'Mesh size',
      dataType: 'number',
      unit: 'mm',
      minValue: 1,
      maxValue: null
    }
  ],
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'TBB',
      name: 'Beam trawl',
      type: 'trawl',
      categoryId: 'cat-1',
      pairFishing: false,
      applicableCharacteristics: [
        {
          id: 'rel-1',
          characteristicId: 'char-1',
          fixed: true,
          required: true,
          vesselLengthApplicability: ['under-10m']
        }
      ],
      active: true
    }
  ]
}

function createService() {
  const store = createInMemoryDataStore()
  store.setCollection('gears', COLLECTION, {
    collectionId: 'c1',
    schemaVersion: '1.0',
    version: 'v1'
  })
  return createCollectionQueryService({ store })
}

describe('#gearsQueryConfiguration', () => {
  test('retrieves the full collection', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {})
    expect(result.totalCount).toBe(1)
  })

  test('canonical output never leaks the internal category/characteristic enrichment', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {})
    expect(result.items[0]).not.toHaveProperty('_categoryCode')
    expect(result.items[0]).not.toHaveProperty('_categoryName')
    expect(result.items[0]).not.toHaveProperty('_searchableCharacteristics')
  })

  test('search by category name', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      query: 'trawls'
    })
    expect(result.items).toHaveLength(1)
  })

  test('categoryCode filter', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      categoryCode: 'trawl'
    })
    expect(result.items).toHaveLength(1)
  })

  test('pairFishing filter', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      pairFishing: 'false'
    })
    expect(result.items).toHaveLength(1)
    expect(
      createService().queryCollection(gearsQueryConfiguration, {
        pairFishing: 'true'
      }).items
    ).toHaveLength(0)
  })

  test('rejects an invalid pairFishing value', () => {
    expect(() =>
      createService().queryCollection(gearsQueryConfiguration, {
        pairFishing: 'maybe'
      })
    ).toThrow()
  })

  test('mobile view with vessel length applies applicability', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      view: 'mobile',
      vesselLengthMetres: '8.5'
    })
    expect(result.items[0].requiredMeasurementIds).toEqual(['char-1'])
  })

  test('mobile view with a non-applicable vessel length excludes the characteristic', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      view: 'mobile',
      vesselLengthMetres: '15'
    })
    expect(result.items[0].requiredMeasurementIds).toEqual([])
  })

  test('mobile view without vessel length includes every applicable characteristic', () => {
    const result = createService().queryCollection(gearsQueryConfiguration, {
      view: 'mobile'
    })
    expect(result.items[0].requiredMeasurementIds).toEqual(['char-1'])
  })

  test('sorting by type, categoryName, categoryCode, and pairFishing', () => {
    const store = createInMemoryDataStore()
    const twoItemCollection = {
      categories: COLLECTION.categories,
      characteristics: COLLECTION.characteristics,
      items: [
        COLLECTION.items[0],
        {
          ...COLLECTION.items[0],
          id: '22222222-2222-4222-8222-222222222222',
          code: 'AAA',
          name: 'Another gear',
          type: 'another-type',
          pairFishing: true
        }
      ]
    }
    store.setCollection('gears', twoItemCollection, {
      collectionId: 'c2',
      schemaVersion: '1.0',
      version: 'v1'
    })
    const service = createCollectionQueryService({ store })

    expect(
      service
        .queryCollection(gearsQueryConfiguration, { sort: 'type' })
        .items.map((gear) => gear.type)
    ).toEqual(['another-type', 'trawl'])

    expect(
      service.queryCollection(gearsQueryConfiguration, { sort: 'categoryName' })
        .items
    ).toHaveLength(2)

    expect(
      service.queryCollection(gearsQueryConfiguration, { sort: 'categoryCode' })
        .items
    ).toHaveLength(2)

    expect(
      service
        .queryCollection(gearsQueryConfiguration, { sort: 'pairFishing' })
        .items.map((gear) => gear.pairFishing)
    ).toEqual([false, true])
  })

  test('a gear referencing an unresolved category still resolves without throwing', () => {
    const store = createInMemoryDataStore()
    const collectionWithUnresolvedCategory = {
      categories: [],
      characteristics: COLLECTION.characteristics,
      items: [{ ...COLLECTION.items[0], categoryId: 'missing-category' }]
    }
    store.setCollection('gears', collectionWithUnresolvedCategory, {
      collectionId: 'c3',
      schemaVersion: '1.0',
      version: 'v1'
    })
    const service = createCollectionQueryService({ store })

    const result = service.queryCollection(gearsQueryConfiguration, {
      categoryCode: 'trawl'
    })

    expect(result.items).toHaveLength(0)
  })
})
