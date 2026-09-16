import { describe, expect, test } from 'vitest'

import Joi from 'joi'

import {
  createFeatureCollectionSchema,
  createFeatureSchema,
  geometrySchema,
  multiPolygonGeometrySchema,
  polygonGeometrySchema,
  positionSchema
} from './geojson.js'

describe('#positionSchema', () => {
  test('accepts a 2D position', () => {
    expect(positionSchema.validate([-4.1427, 50.3661]).error).toBeUndefined()
  })

  test('rejects a non-numeric coordinate', () => {
    expect(positionSchema.validate(['-4.1427', 50.3661]).error).toBeDefined()
  })
})

describe('#polygonGeometrySchema', () => {
  test('accepts a valid Polygon', () => {
    const { error } = polygonGeometrySchema.validate({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 0]
        ]
      ]
    })

    expect(error).toBeUndefined()
  })

  test('rejects an invalid geometry type', () => {
    const { error } = polygonGeometrySchema.validate({
      type: 'Point',
      coordinates: [0, 0]
    })

    expect(error).toBeDefined()
  })
})

describe('#multiPolygonGeometrySchema', () => {
  test('accepts a valid MultiPolygon', () => {
    const { error } = multiPolygonGeometrySchema.validate({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [0, 0]
          ]
        ]
      ]
    })

    expect(error).toBeUndefined()
  })
})

describe('#geometrySchema', () => {
  test('rejects an unsupported geometry type', () => {
    const { error } = geometrySchema.validate({
      type: 'LineString',
      coordinates: []
    })

    expect(error).toBeDefined()
  })
})

describe('#createFeatureSchema / #createFeatureCollectionSchema', () => {
  const propertiesSchema = Joi.object({ id: Joi.string().guid().required() })
  const featureSchema = createFeatureSchema(propertiesSchema)
  const featureCollectionSchema = createFeatureCollectionSchema(featureSchema)

  test('rejects an invalid root type', () => {
    const { error } = featureCollectionSchema.validate({
      type: 'Feature',
      features: []
    })

    expect(error).toBeDefined()
  })

  test('accepts a valid feature collection', () => {
    const { error } = featureCollectionSchema.validate({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '12639177-7614-4616-83cd-6141ecb83924',
          properties: { id: '12639177-7614-4616-83cd-6141ecb83924' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [0, 0]
              ]
            ]
          }
        }
      ]
    })

    expect(error).toBeUndefined()
  })
})
