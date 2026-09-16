import { describe, expect, test } from 'vitest'

import { normaliseMapLandCollection } from './map-land-normaliser.js'
import validMapLandCollection from '#/common/schemas/fixtures/valid/map-land.json' with { type: 'json' }

describe('#normaliseMapLandCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normaliseMapLandCollection(validMapLandCollection)
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validMapLandCollection)
  })

  test('trims whitespace from a feature name, preserving the feature GUID and geometry', () => {
    const collection = structuredClone(validMapLandCollection)
    collection.features[0].properties.name = '  Rame Head  '
    const originalGeometry = structuredClone(collection.features[0].geometry)

    const result = normaliseMapLandCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.features[0].properties.name).toBe('Rame Head')
    expect(result.value.features[0].id).toBe(
      validMapLandCollection.features[0].id
    )
    expect(result.value.features[0].geometry).toEqual(originalGeometry)
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validMapLandCollection)
    const before = structuredClone(collection)

    normaliseMapLandCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validMapLandCollection)
    collection.features[0].properties.name = '  Rame Head  '

    const first = normaliseMapLandCollection(collection)
    const second = normaliseMapLandCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
