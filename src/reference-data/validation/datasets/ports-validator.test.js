import { describe, expect, test } from 'vitest'

import { validatePortsCollection } from './ports-validator.js'

function portItem(overrides = {}) {
  return {
    id: '73168db4-1996-46f8-91cb-2288fe2e689c',
    code: 'GBPLY',
    name: 'Plymouth',
    countryCode: 'GBR',
    coordinate: { latitude: 50.3661, longitude: -4.1427 },
    active: true,
    ...overrides
  }
}

describe('#validatePortsCollection', () => {
  test('accepts unique port codes', () => {
    const result = validatePortsCollection({
      items: [
        portItem(),
        portItem({ id: '22222222-2222-4222-8222-222222222222', code: 'GBFAL' })
      ]
    })
    expect(result).toEqual({ valid: true, errors: [], warnings: [] })
  })

  test('detects a duplicate port code', () => {
    const result = validatePortsCollection({
      items: [
        portItem(),
        portItem({ id: '22222222-2222-4222-8222-222222222222' })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'duplicate_business_code',
        rejectedValue: 'GBPLY'
      })
    ])
  })

  test('port codes are compared exactly (case-sensitive)', () => {
    const result = validatePortsCollection({
      items: [
        portItem({ code: 'GBPLY' }),
        portItem({ id: '22222222-2222-4222-8222-222222222222', code: 'gbply' })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('does not mutate the supplied collection', () => {
    const collection = { items: [portItem()] }
    const before = structuredClone(collection)

    validatePortsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('tolerates a collection with no items array', () => {
    expect(validatePortsCollection({})).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })
})
