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
})
