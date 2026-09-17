import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { mapLandQueryConfiguration } from './map-land-query-configuration.js'

const SQUARE_RING = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0],
  [0, 0]
]

function buildFeature(overrides = {}) {
  return {
    type: 'Feature',
    id: '11111111-1111-4111-8111-111111111111',
    properties: { id: '11111111-1111-4111-8111-111111111111', name: 'Island' },
    geometry: { type: 'Polygon', coordinates: [SQUARE_RING] },
    ...overrides
  }
}

function createService(features) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'map-land',
    { type: 'FeatureCollection', features },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  return createCollectionQueryService({ store })
}

describe('#mapLandQueryConfiguration', () => {
  test('retrieves the full FeatureCollection', () => {
    const result = createService([buildFeature()]).queryCollection(
      mapLandQueryConfiguration,
      {}
    )
    expect(result.totalCount).toBe(1)
  })

  test('general search matches by name only', () => {
    const service = createService([buildFeature()])
    expect(
      service.queryCollection(mapLandQueryConfiguration, { query: 'island' })
        .items
    ).toHaveLength(1)
    expect(
      service.queryCollection(mapLandQueryConfiguration, { query: 'nomatch' })
        .items
    ).toHaveLength(0)
  })

  test('bbox filters via true polygon intersection', () => {
    const service = createService([buildFeature()])
    expect(
      service.queryCollection(mapLandQueryConfiguration, {
        bbox: '2,2,8,8'
      }).items
    ).toHaveLength(1)
    expect(
      service.queryCollection(mapLandQueryConfiguration, {
        bbox: '50,50,60,60'
      }).items
    ).toHaveLength(0)
  })

  test('an invalid bbox is rejected', () => {
    expect(() =>
      createService([buildFeature()]).queryCollection(
        mapLandQueryConfiguration,
        { bbox: 'not-a-bbox' }
      )
    ).toThrow()
  })

  test('malformed geometry fails the whole request', () => {
    const service = createService([
      buildFeature({ geometry: { type: 'Point', coordinates: [0, 0] } })
    ])
    expect(() =>
      service.queryCollection(mapLandQueryConfiguration, { bbox: '2,2,8,8' })
    ).toThrow()
  })

  test('an unsupported query parameter is rejected', () => {
    expect(() =>
      createService([buildFeature()]).queryCollection(
        mapLandQueryConfiguration,
        { code: 'x' }
      )
    ).toThrow(/Unsupported query parameter/)
  })

  test('is not paginated', () => {
    const result = createService([buildFeature()]).queryCollection(
      mapLandQueryConfiguration,
      { query: 'island' }
    )
    expect(result.offset).toBeUndefined()
    expect(result.limit).toBeUndefined()
  })

  test('does not mutate the canonical collection', () => {
    const feature = buildFeature()
    const clone = JSON.parse(JSON.stringify(feature))
    createService([feature]).queryCollection(mapLandQueryConfiguration, {
      bbox: '2,2,8,8'
    })
    expect(feature).toEqual(clone)
  })
})
