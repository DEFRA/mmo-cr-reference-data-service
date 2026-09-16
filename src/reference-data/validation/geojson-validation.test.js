import { describe, expect, test } from 'vitest'

import { validateFeatureCollectionGeometries } from './geojson-validation.js'

function feature(geometry) {
  return { type: 'Feature', id: 'f1', properties: {}, geometry }
}

describe('#validateFeatureCollectionGeometries', () => {
  test('returns no issues for a valid closed Polygon within WGS84 range', () => {
    const collection = {
      features: [
        feature({
          type: 'Polygon',
          coordinates: [
            [
              [-4.2, 50.3],
              [-4.2, 50.4],
              [-4.1, 50.4],
              [-4.2, 50.3]
            ]
          ]
        })
      ]
    }

    expect(validateFeatureCollectionGeometries(collection)).toEqual([])
  })

  test('returns no issues for a valid MultiPolygon', () => {
    const ring = [
      [-4.2, 50.3],
      [-4.2, 50.4],
      [-4.1, 50.4],
      [-4.2, 50.3]
    ]
    const collection = {
      features: [feature({ type: 'MultiPolygon', coordinates: [[ring]] })]
    }

    expect(validateFeatureCollectionGeometries(collection)).toEqual([])
  })

  test('detects an open polygon ring', () => {
    const collection = {
      features: [
        feature({
          type: 'Polygon',
          coordinates: [
            [
              [-4.2, 50.3],
              [-4.2, 50.4],
              [-4.1, 50.4],
              [-4.1, 50.3]
            ]
          ]
        })
      ]
    }

    const issues = validateFeatureCollectionGeometries(collection)

    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('open_polygon_ring')
  })

  test('detects a longitude outside the WGS84 range', () => {
    const collection = {
      features: [
        feature({
          type: 'Polygon',
          coordinates: [
            [
              [-190, 50.3],
              [-4.2, 50.4],
              [-4.1, 50.4],
              [-190, 50.3]
            ]
          ]
        })
      ]
    }

    const issues = validateFeatureCollectionGeometries(collection)

    expect(issues.some((issue) => issue.code === 'invalid_coordinate')).toBe(
      true
    )
  })

  test('detects a latitude outside the WGS84 range', () => {
    const collection = {
      features: [
        feature({
          type: 'Polygon',
          coordinates: [
            [
              [-4.2, 95],
              [-4.2, 50.4],
              [-4.1, 50.4],
              [-4.2, 95]
            ]
          ]
        })
      ]
    }

    const issues = validateFeatureCollectionGeometries(collection)

    expect(issues.some((issue) => issue.code === 'invalid_coordinate')).toBe(
      true
    )
  })

  test('detects an empty Polygon', () => {
    const collection = {
      features: [feature({ type: 'Polygon', coordinates: [] })]
    }

    const issues = validateFeatureCollectionGeometries(collection)

    expect(issues).toEqual([
      expect.objectContaining({ code: 'empty_geometry' })
    ])
  })

  test('detects an empty MultiPolygon', () => {
    const collection = {
      features: [feature({ type: 'MultiPolygon', coordinates: [] })]
    }

    const issues = validateFeatureCollectionGeometries(collection)

    expect(issues).toEqual([
      expect.objectContaining({ code: 'empty_geometry' })
    ])
  })

  test('ignores a feature with no geometry rather than throwing', () => {
    const collection = { features: [feature(undefined)] }

    expect(() => validateFeatureCollectionGeometries(collection)).not.toThrow()
  })

  test('returns an empty array when features is not an array', () => {
    expect(validateFeatureCollectionGeometries({})).toEqual([])
  })
})
