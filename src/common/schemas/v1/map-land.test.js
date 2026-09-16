import { describe, expect, test } from 'vitest'

import { mapLandCollectionSchema, mapLandFeatureSchema } from './map-land.js'

const validPolygonFeature = {
  type: 'Feature',
  id: '12639177-7614-4616-83cd-6141ecb83924',
  properties: { id: '12639177-7614-4616-83cd-6141ecb83924', name: 'Rame Head' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-4.2, 50.3],
        [-4.2, 50.4],
        [-4.1, 50.4],
        [-4.2, 50.3]
      ]
    ]
  }
}

describe('#mapLandFeatureSchema', () => {
  test('accepts a valid Polygon feature', () => {
    expect(
      mapLandFeatureSchema.validate(validPolygonFeature).error
    ).toBeUndefined()
  })

  test('accepts a valid MultiPolygon feature', () => {
    const multiPolygonFeature = {
      ...validPolygonFeature,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [validPolygonFeature.geometry.coordinates]
      }
    }

    expect(
      mapLandFeatureSchema.validate(multiPolygonFeature).error
    ).toBeUndefined()
  })

  test('rejects an invalid root/feature type', () => {
    const { error } = mapLandFeatureSchema.validate({
      ...validPolygonFeature,
      type: 'FeatureCollection'
    })

    expect(error).toBeDefined()
  })

  test('rejects an invalid geometry type', () => {
    const { error } = mapLandFeatureSchema.validate({
      ...validPolygonFeature,
      geometry: { type: 'Point', coordinates: [0, 0] }
    })

    expect(error).toBeDefined()
  })

  test('rejects a non-numeric coordinate', () => {
    const { error } = mapLandFeatureSchema.validate({
      ...validPolygonFeature,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            ['-4.2', 50.3],
            [-4.2, 50.4],
            [-4.1, 50.4],
            ['-4.2', 50.3]
          ]
        ]
      }
    })

    expect(error).toBeDefined()
  })
})

describe('#mapLandCollectionSchema', () => {
  test('accepts a valid map-land feature collection', () => {
    const collection = {
      dataset: 'map-land',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      type: 'FeatureCollection',
      features: [validPolygonFeature]
    }

    expect(mapLandCollectionSchema.validate(collection).error).toBeUndefined()
  })
})
