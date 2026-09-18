import { describe, expect, test } from 'vitest'

import { validateMapStatisticalAreasCollection } from './map-statistical-areas-validator.js'

function statAreaFeature(overrides = {}) {
  return {
    type: 'Feature',
    id: '12639177-7614-4616-83cd-6141ecb83924',
    properties: {
      id: '12639177-7614-4616-83cd-6141ecb83924',
      code: '27D86',
      name: 'ICES subrectangle 27D86',
      areaType: 'ices-subrectangle',
      parentCode: '27D8'
    },
    ...overrides
  }
}

describe('#validateMapStatisticalAreasCollection', () => {
  test('accepts unique area codes', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature(),
        statAreaFeature({
          id: '22222222-2222-4222-8222-222222222222',
          properties: {
            ...statAreaFeature().properties,
            id: '22222222-2222-4222-8222-222222222222',
            code: '27D87'
          }
        })
      ]
    })

    expect(result).toEqual({ valid: true, errors: [], warnings: [] })
  })

  test('detects a duplicate area code (case-insensitive)', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature(),
        statAreaFeature({
          id: '22222222-2222-4222-8222-222222222222',
          properties: {
            ...statAreaFeature().properties,
            id: '22222222-2222-4222-8222-222222222222',
            code: '27d86'
          }
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'duplicate_business_code' })
    ])
  })

  test('a parentCode with no matching feature in the collection is not an error (structural-only)', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature({
          properties: {
            ...statAreaFeature().properties,
            parentCode: 'does-not-exist'
          }
        })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('an optional (null) parentCode is accepted', () => {
    const result = validateMapStatisticalAreasCollection({
      features: [
        statAreaFeature({
          properties: { ...statAreaFeature().properties, parentCode: null }
        })
      ]
    })

    expect(result.valid).toBe(true)
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
