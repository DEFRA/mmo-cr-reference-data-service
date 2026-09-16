import { describe, expect, test } from 'vitest'

import {
  mapStatisticalAreaFeatureSchema,
  mapStatisticalAreasCollectionSchema
} from './map-statistical-areas.js'

const validFeature = {
  type: 'Feature',
  id: '12639177-7614-4616-83cd-6141ecb83924',
  properties: {
    id: '12639177-7614-4616-83cd-6141ecb83924',
    code: '27D86',
    name: 'ICES subrectangle 27D86',
    areaType: 'ices-subrectangle',
    parentCode: '27D8',
    parentName: 'ICES rectangle 27D8',
    areaKm2: 312.48,
    centroid: { latitude: 50.25, longitude: -4.5 }
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-4.6, 50.2],
        [-4.6, 50.3],
        [-4.4, 50.3],
        [-4.6, 50.2]
      ]
    ]
  }
}

describe('#mapStatisticalAreaFeatureSchema', () => {
  test('accepts a valid feature', () => {
    expect(
      mapStatisticalAreaFeatureSchema.validate(validFeature).error
    ).toBeUndefined()
  })

  test('requires a feature id and a properties.id', () => {
    const { id, ...withoutId } = validFeature

    expect(
      mapStatisticalAreaFeatureSchema.validate(withoutId).error
    ).toBeDefined()
  })

  test('rejects a missing statistical-area code', () => {
    const { code, ...propertiesWithoutCode } = validFeature.properties

    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: propertiesWithoutCode
    })

    expect(error).toBeDefined()
  })

  test('accepts a feature without optional parent/area/centroid fields', () => {
    const { parentCode, parentName, areaKm2, centroid, ...minimalProperties } =
      validFeature.properties

    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: minimalProperties
    })

    expect(error).toBeUndefined()
  })
})

describe('#mapStatisticalAreasCollectionSchema', () => {
  test('accepts a valid statistical-areas feature collection', () => {
    const collection = {
      dataset: 'map-statistical-areas',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      type: 'FeatureCollection',
      features: [validFeature]
    }

    expect(
      mapStatisticalAreasCollectionSchema.validate(collection).error
    ).toBeUndefined()
  })
})
