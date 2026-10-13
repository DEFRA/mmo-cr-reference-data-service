import { describe, expect, test } from 'vitest'

import {
  mapStatisticalAreaFeatureSchema,
  mapStatisticalAreasCollectionSchema
} from './map-statistical-areas.js'

const validFeature = {
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
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-556597.45, 6446275.84],
          [-500937.71, 6446275.84],
          [-500937.71, 6489684.53],
          [-556597.45, 6489684.53],
          [-556597.45, 6446275.84]
        ]
      ]
    ]
  }
}

const validCrs = {
  type: 'name',
  properties: { name: 'urn:ogc:def:crs:EPSG::3857' }
}

describe('#mapStatisticalAreaFeatureSchema', () => {
  test('accepts a valid raw feature', () => {
    expect(
      mapStatisticalAreaFeatureSchema.validate(validFeature).error
    ).toBeUndefined()
  })

  test('has no Feature.id and rejects one if supplied', () => {
    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      id: '12639177-7614-4616-83cd-6141ecb83924'
    })
    expect(error).toBeDefined()
  })

  test('rejects a missing OBJECTID (the item identifier)', () => {
    const { OBJECTID, ...propertiesWithoutObjectId } = validFeature.properties

    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: propertiesWithoutObjectId
    })

    expect(error).toBeDefined()
  })

  test('rejects a missing sub_code (the business-uniqueness key)', () => {
    const { sub_code: _subCode, ...propertiesWithoutSubCode } =
      validFeature.properties

    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: propertiesWithoutSubCode
    })

    expect(error).toBeDefined()
  })

  test('rejects an unrecognised property (strict enumeration, not unknown(true))', () => {
    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: { ...validFeature.properties, UNDOCUMENTED_COLUMN: 'x' }
    })

    expect(error).toBeDefined()
  })

  test('rejects a Polygon geometry (raw export is MultiPolygon-only)', () => {
    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      geometry: {
        type: 'Polygon',
        coordinates: validFeature.geometry.coordinates[0]
      }
    })

    expect(error).toBeDefined()
  })

  test('accepts a feature without optional ArcGIS columns', () => {
    const {
      OBJECTID_1,
      stat_x: _statX,
      stat_y: _statY,
      sub_str: _subStr,
      sub_x: _subX,
      sub_y: _subY,
      ...minimalProperties
    } = validFeature.properties

    const { error } = mapStatisticalAreaFeatureSchema.validate({
      ...validFeature,
      properties: minimalProperties
    })

    expect(error).toBeUndefined()
  })
})

describe('#mapStatisticalAreasCollectionSchema', () => {
  test('accepts a valid statistical-areas feature collection with a top-level crs member', () => {
    const collection = {
      dataset: 'map-statistical-areas',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      type: 'FeatureCollection',
      crs: validCrs,
      features: [validFeature]
    }

    expect(
      mapStatisticalAreasCollectionSchema.validate(collection).error
    ).toBeUndefined()
  })

  test('rejects a collection missing the top-level crs member', () => {
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
    ).toBeDefined()
  })
})
