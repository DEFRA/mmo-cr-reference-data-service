import { describe, expect, test } from 'vitest'

import { validateCommonEnvelope } from './collection-envelope-validator.js'

function baseJsonCollection(overrides = {}) {
  return {
    dataset: 'ports',
    collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
    schemaVersion: '1.0',
    version: '2026.09.11.1',
    generatedAt: '2026-09-11T08:30:00Z',
    itemCount: 1,
    items: [{ id: '73168db4-1996-46f8-91cb-2288fe2e689c', code: 'GBPLY' }],
    ...overrides
  }
}

describe('#validateCommonEnvelope', () => {
  test('returns no issues for a consistent JSON collection', () => {
    expect(
      validateCommonEnvelope({
        dataset: 'ports',
        collection: baseJsonCollection()
      })
    ).toEqual([])
  })

  test('detects a dataset mismatch', () => {
    const issues = validateCommonEnvelope({
      dataset: 'vessels',
      collection: baseJsonCollection({ dataset: 'ports' })
    })

    expect(issues).toEqual([
      expect.objectContaining({ code: 'dataset_mismatch' })
    ])
  })

  test('detects an item-count mismatch', () => {
    const issues = validateCommonEnvelope({
      dataset: 'ports',
      collection: baseJsonCollection({ itemCount: 2 })
    })

    expect(issues).toEqual([
      expect.objectContaining({ code: 'invalid_item_count' })
    ])
  })

  test('detects duplicate item GUIDs', () => {
    const duplicateId = '73168db4-1996-46f8-91cb-2288fe2e689c'
    const issues = validateCommonEnvelope({
      dataset: 'ports',
      collection: baseJsonCollection({
        itemCount: 2,
        items: [
          { id: duplicateId, code: 'GBPLY' },
          { id: duplicateId, code: 'GBFAL' }
        ]
      })
    })

    expect(issues.some((issue) => issue.code === 'duplicate_guid')).toBe(true)
  })

  test('applies GeoJSON common validation for GeoJSON datasets', () => {
    const issues = validateCommonEnvelope({
      dataset: 'map-land',
      collection: {
        dataset: 'map-land',
        itemCount: 1,
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'f1',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [] }
          }
        ]
      }
    })

    expect(issues.some((issue) => issue.code === 'empty_geometry')).toBe(true)
  })

  // Dataset-driven WGS84 range check (ADR 0001): map-land is unaffected and keeps
  // rejecting out-of-WGS84-range coordinates by default.
  test('map-land still rejects out-of-WGS84-range coordinates (shared-code regression guard)', () => {
    const issues = validateCommonEnvelope({
      dataset: 'map-land',
      collection: {
        dataset: 'map-land',
        itemCount: 1,
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'f1',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-190, 50.3],
                  [-4.2, 50.4],
                  [-4.1, 50.4],
                  [-190, 50.3]
                ]
              ]
            }
          }
        ]
      }
    })

    expect(issues.some((issue) => issue.code === 'invalid_coordinate')).toBe(
      true
    )
  })

  // map-statistical-areas (ADR 0001) serves raw EPSG:3857 metre coordinates, so the
  // WGS84 range check must not apply to it.
  test('map-statistical-areas does not apply the WGS84 range check to its EPSG:3857 coordinates', () => {
    const issues = validateCommonEnvelope({
      dataset: 'map-statistical-areas',
      collection: {
        dataset: 'map-statistical-areas',
        itemCount: 1,
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
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
        ]
      }
    })

    expect(issues.some((issue) => issue.code === 'invalid_coordinate')).toBe(
      false
    )
  })

  test('does not throw and returns no issues for a non-object collection', () => {
    expect(
      validateCommonEnvelope({ dataset: 'ports', collection: null })
    ).toEqual([])
  })

  test('skips itemCount and GUID-uniqueness checks when items is missing/not an array', () => {
    const issues = validateCommonEnvelope({
      dataset: 'ports',
      collection: baseJsonCollection({ items: undefined })
    })

    expect(issues).toEqual([])
  })

  test('does not mutate the supplied collection', () => {
    const collection = baseJsonCollection()
    const before = structuredClone(collection)

    validateCommonEnvelope({ dataset: 'ports', collection })

    expect(collection).toEqual(before)
  })
})
