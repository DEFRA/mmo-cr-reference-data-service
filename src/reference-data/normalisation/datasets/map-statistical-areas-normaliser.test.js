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

  test('trims whitespace from ICESNAME/sub_code, preserving other fields exactly as supplied', () => {
    const collection = structuredClone(validMapStatisticalAreasCollection)
    collection.features[0].properties.sub_code = '  27D85  '

    const result = normaliseMapStatisticalAreasCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.features[0].properties.sub_code).toBe('27D85')
    expect(result.value.features[0].properties.ICESNAME).toBe(
      validMapStatisticalAreasCollection.features[0].properties.ICESNAME
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
    collection.features[0].properties.sub_code = '  27D85  '

    const first = normaliseMapStatisticalAreasCollection(collection)
    const second = normaliseMapStatisticalAreasCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
