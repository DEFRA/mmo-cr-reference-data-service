import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { mapStatisticalAreasQueryConfiguration } from './map-statistical-areas-query-configuration.js'

const SQUARE_RING = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0],
  [0, 0]
]

function buildFeature(overrides = {}) {
  const id = overrides.id ?? '11111111-1111-4111-8111-111111111111'
  return {
    type: 'Feature',
    id,
    properties: {
      id,
      code: '27D86',
      name: 'ICES subrectangle 27D86',
      areaType: 'ices-subrectangle',
      parentCode: '27D8',
      parentName: 'ICES rectangle 27D8',
      areaKm2: 312.48,
      centroid: { latitude: 50.25, longitude: -4.5 }
    },
    geometry: { type: 'Polygon', coordinates: [SQUARE_RING] },
    ...overrides
  }
}

function createService(features) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'map-statistical-areas',
    { type: 'FeatureCollection', features },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  return createCollectionQueryService({ store })
}

describe('#mapStatisticalAreasQueryConfiguration', () => {
  test('retrieves the full FeatureCollection', () => {
    const result = createService([buildFeature()]).queryCollection(
      mapStatisticalAreasQueryConfiguration,
      {}
    )
    expect(result.totalCount).toBe(1)
  })

  describe('code filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          code: '27D86'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          code: '27d86'
        }).items
      ).toHaveLength(1)
    })

    test('does not match a partial value', () => {
      const result = createService([buildFeature()]).queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { code: '27D8' }
      )
      expect(result.items).toHaveLength(0)
    })

    test('preserves the canonical code', () => {
      const result = createService([buildFeature()]).queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { code: '27d86' }
      )
      expect(result.items[0].properties.code).toBe('27D86')
    })
  })

  describe('parentCode filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          parentCode: '27D8'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          parentCode: '27d8'
        }).items
      ).toHaveLength(1)
    })

    test('a null parentCode does not match', () => {
      const result = createService([
        buildFeature({
          properties: { ...buildFeature().properties, parentCode: null }
        })
      ]).queryCollection(mapStatisticalAreasQueryConfiguration, {
        parentCode: '27D8'
      })
      expect(result.items).toHaveLength(0)
    })
  })

  describe('general text search', () => {
    test('matches name, code, areaType, parentCode, and parentName', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: 'subrectangle'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '27d86'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: 'ices-subrectangle'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '27d8'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: 'ICES rectangle'
        }).items
      ).toHaveLength(1)
    })

    test('does not match on GUID or geometry', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '11111111'
        }).items
      ).toHaveLength(0)
    })

    test('handles a missing parentCode/parentName safely', () => {
      const feature = buildFeature({
        properties: {
          ...buildFeature().properties,
          parentCode: null,
          parentName: null
        }
      })
      const result = createService([feature]).queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { query: '27D86' }
      )
      expect(result.items).toHaveLength(1)
    })

    test('a feature matching on multiple fields is returned once', () => {
      const service = createService([buildFeature()])
      const result = service.queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { query: '27D8' }
      )
      expect(result.items).toHaveLength(1)
    })
  })

  test('bbox filters via true polygon intersection', () => {
    const service = createService([buildFeature()])
    expect(
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        bbox: '2,2,8,8'
      }).items
    ).toHaveLength(1)
    expect(
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        bbox: '50,50,60,60'
      }).items
    ).toHaveLength(0)
  })

  test('combines filters using AND', () => {
    const service = createService([buildFeature()])
    const result = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { code: '27D86', parentCode: 'DIFFERENT' }
    )
    expect(result.items).toHaveLength(0)
  })

  test('malformed geometry fails the whole request', () => {
    const service = createService([
      buildFeature({ geometry: { type: 'Point', coordinates: [0, 0] } })
    ])
    expect(() =>
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        bbox: '2,2,8,8'
      })
    ).toThrow()
  })

  test('retrieves a single feature by GUID', () => {
    const service = createService([buildFeature()])
    const result = service.getItemById(
      mapStatisticalAreasQueryConfiguration,
      '11111111-1111-4111-8111-111111111111',
      {}
    )
    expect(result.item.properties.code).toBe('27D86')
  })

  test('is not paginated', () => {
    const result = createService([buildFeature()]).queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { query: '27D86' }
    )
    expect(result.offset).toBeUndefined()
  })

  test('sorts by name and by code', () => {
    const featureA = buildFeature({
      id: '22222222-2222-4222-8222-222222222222',
      properties: {
        id: '22222222-2222-4222-8222-222222222222',
        code: '10A11',
        name: 'ICES subrectangle 10A11',
        areaType: 'ices-subrectangle',
        parentCode: '10A1',
        parentName: 'ICES rectangle 10A1',
        areaKm2: 312.48,
        centroid: { latitude: 50.25, longitude: -4.5 }
      }
    })
    const service = createService([buildFeature(), featureA])

    const byName = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { sort: 'name' }
    )
    expect(byName.items.map((f) => f.properties.name)).toEqual([
      'ICES subrectangle 10A11',
      'ICES subrectangle 27D86'
    ])

    const byCode = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { sort: 'code' }
    )
    expect(byCode.items.map((f) => f.properties.code)).toEqual([
      '10A11',
      '27D86'
    ])
  })
})
