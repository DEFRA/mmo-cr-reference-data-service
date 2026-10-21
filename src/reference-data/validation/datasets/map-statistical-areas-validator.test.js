import { describe, expect, test } from 'vitest'

import { validateMapStatisticalAreasCollection } from './map-statistical-areas-validator.js'

function statAreaFeature(overrides = {}) {
  return {
    type: 'Feature',
    properties: {
      OBJECTID: 1,
      ICESNAME: '27D8',
      sub_code: '27D85'
    },
    ...overrides
  }
}

describe('#validateMapStatisticalAreasCollection', () => {
  test('accepts unique sub_codes', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature(),
        statAreaFeature({
          properties: { OBJECTID: 2, ICESNAME: '27D8', sub_code: '27D86' }
        })
      ]
    })

    expect(result).toEqual({ valid: true, errors: [], warnings: [] })
  })

  test('a repeated ICESNAME across subrectangles with distinct sub_codes is not a duplicate', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature({
          properties: { OBJECTID: 1, ICESNAME: '27D8', sub_code: '27D85' }
        }),
        statAreaFeature({
          properties: { OBJECTID: 2, ICESNAME: '27D8', sub_code: '27D86' }
        }),
        statAreaFeature({
          properties: { OBJECTID: 3, ICESNAME: '27D8', sub_code: '27D89' }
        })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('detects a duplicate sub_code (case-insensitive)', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature(),
        statAreaFeature({
          properties: { OBJECTID: 2, ICESNAME: '27D8', sub_code: '27d85' }
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'duplicate_business_code' })
    ])
  })

  test('does not mutate the supplied collection', () => {
    const collection = { features: [statAreaFeature()] }
    const before = structuredClone(collection)

    validateMapStatisticalAreasCollection(collection)

    expect(collection).toEqual(before)
  })

  test('tolerates a collection with no features array', () => {
    expect(validateMapStatisticalAreasCollection({})).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })
})
