import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { mapStatisticalAreasQueryConfiguration } from './map-statistical-areas-query-configuration.js'

const SQUARE_METRE_RING = [
  [-556597.45, 6446275.84],
  [-500937.71, 6446275.84],
  [-500937.71, 6489684.53],
  [-556597.45, 6489684.53],
  [-556597.45, 6446275.84]
]

function buildFeature(overrides = {}) {
  return {
    type: 'Feature',
    properties: {
      OBJECTID: 1,
      OBJECTID_1: 1,
      ICESNAME: '27D8',
      SOUTH: 50.0,
      WEST: -5.0,
      NORTH: 50.25,
      EAST: -4.5,
      AREA_KM2: 2416.12,
      stat_x: -500937.71,
      stat_y: 6489684.53,
      sub_code: '27D85',
      sub_str: 1,
      sub_x: -528767.58,
      sub_y: 6467951.85,
      Shape_Leng: 198136.86,
      Shape_Area: 2416116399.14
    },
    geometry: { type: 'MultiPolygon', coordinates: [[SQUARE_METRE_RING]] },
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

  describe('sub_code filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          sub_code: '27D85'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          sub_code: '27d85'
        }).items
      ).toHaveLength(1)
    })

    test('does not match a partial value', () => {
      const result = createService([buildFeature()]).queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { sub_code: '27D8' }
      )
      expect(result.items).toHaveLength(0)
    })

    test('preserves the canonical sub_code', () => {
      const result = createService([buildFeature()]).queryCollection(
        mapStatisticalAreasQueryConfiguration,
        { sub_code: '27d85' }
      )
      expect(result.items[0].properties.sub_code).toBe('27D85')
    })
  })

  describe('ICESNAME filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          ICESNAME: '27D8'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          ICESNAME: '27d8'
        }).items
      ).toHaveLength(1)
    })

    test('matches multiple subrectangles sharing the same ICESNAME', () => {
      const service = createService([
        buildFeature(),
        buildFeature({
          properties: {
            ...buildFeature().properties,
            OBJECTID: 2,
            sub_code: '27D86'
          }
        })
      ])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          ICESNAME: '27D8'
        }).items
      ).toHaveLength(2)
    })
  })

  describe('general text search', () => {
    test('matches ICESNAME and sub_code', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '27D85'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '27d8'
        }).items
      ).toHaveLength(1)
    })

    test('does not match on OBJECTID or geometry', () => {
      const service = createService([buildFeature()])
      expect(
        service.queryCollection(mapStatisticalAreasQueryConfiguration, {
          query: '6446275'
        }).items
      ).toHaveLength(0)
    })
  })

  test('bbox is no longer a recognised query parameter', () => {
    const service = createService([buildFeature()])
    expect(() =>
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        bbox: '2,2,8,8'
      })
    ).toThrow(/Unsupported query parameter/)
  })

  test('code and parentCode are no longer recognised query parameters', () => {
    const service = createService([buildFeature()])
    expect(() =>
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        code: '27D85'
      })
    ).toThrow(/Unsupported query parameter/)
    expect(() =>
      service.queryCollection(mapStatisticalAreasQueryConfiguration, {
        parentCode: '27D8'
      })
    ).toThrow(/Unsupported query parameter/)
  })

  test('combines filters using AND', () => {
    const service = createService([buildFeature()])
    const result = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { sub_code: '27D85', ICESNAME: 'DIFFERENT' }
    )
    expect(result.items).toHaveLength(0)
  })

  test('retrieves a single feature by OBJECTID', () => {
    const service = createService([buildFeature()])
    const result = service.getItemById(
      mapStatisticalAreasQueryConfiguration,
      '1',
      {}
    )
    expect(result.item.properties.sub_code).toBe('27D85')
  })

  test('a non-integer OBJECTID string is rejected', () => {
    const service = createService([buildFeature()])
    expect(() =>
      service.getItemById(
        mapStatisticalAreasQueryConfiguration,
        'not-a-number',
        {}
      )
    ).toThrow(/invalid id/)
  })

  test('is not paginated', () => {
    const result = createService([buildFeature()]).queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { query: '27D85' }
    )
    expect(result.offset).toBeUndefined()
  })

  test('sorts by OBJECTID (default) and by sub_code', () => {
    const featureA = buildFeature({
      properties: {
        ...buildFeature().properties,
        OBJECTID: 2,
        sub_code: '10A11'
      }
    })
    const service = createService([buildFeature(), featureA])

    const byObjectId = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { sort: 'OBJECTID' }
    )
    expect(byObjectId.items.map((f) => f.properties.OBJECTID)).toEqual([1, 2])

    const bySubCode = service.queryCollection(
      mapStatisticalAreasQueryConfiguration,
      { sort: 'sub_code' }
    )
    expect(bySubCode.items.map((f) => f.properties.sub_code)).toEqual([
      '10A11',
      '27D85'
    ])
  })
})
