import { describe, expect, test } from 'vitest'

import { normaliseMapStatisticalAreasCollection } from './map-statistical-areas-normaliser.js'
import validMapStatisticalAreasCollection from '#/common/schemas/fixtures/valid/map-statistical-areas.json' with { type: 'json' }

describe('#normaliseMapStatisticalAreasCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normaliseMapStatisticalAreasCollection(
      validMapStatisticalAreasCollection
    )
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validMapStatisticalAreasCollection)
  })

  test('trims whitespace from area code/name, preserving parentCode exactly as supplied', () => {
    const collection = structuredClone(validMapStatisticalAreasCollection)
    collection.features[0].properties.code = '  27D86  '

    const result = normaliseMapStatisticalAreasCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.features[0].properties.code).toBe('27D86')
    expect(result.value.features[0].properties.parentCode).toBe(
      validMapStatisticalAreasCollection.features[0].properties.parentCode
    )
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validMapStatisticalAreasCollection)
    const before = structuredClone(collection)

    normaliseMapStatisticalAreasCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validMapStatisticalAreasCollection)
    collection.features[0].properties.code = '  27D86  '

    const first = normaliseMapStatisticalAreasCollection(collection)
    const second = normaliseMapStatisticalAreasCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
