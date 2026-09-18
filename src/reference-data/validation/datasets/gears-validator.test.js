import { describe, expect, test } from 'vitest'

import { validateGearsCollection } from './gears-validator.js'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTERISTIC_ID = '22222222-2222-4222-8222-222222222222'

function baseCollection(overrides = {}) {
  return {
    categories: [{ id: CATEGORY_ID, code: 'TOWED', name: 'Towed gear' }],
    characteristics: [
      {
        id: CHARACTERISTIC_ID,
        code: 'MESH_SIZE',
        name: 'Mesh size',
        dataType: 'number',
        minValue: 20,
        maxValue: 300
      }
    ],
    items: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        code: 'OTB',
        name: 'Otter trawl',
        categoryId: CATEGORY_ID,
        applicableCharacteristics: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            characteristicId: CHARACTERISTIC_ID,
            fixed: true,
            required: false,
            vesselLengthApplicability: ['under-10m', '10-to-12m']
          }
        ]
      }
    ],
    ...overrides
  }
}

describe('#validateGearsCollection', () => {
  test('accepts a fully consistent collection', () => {
    expect(validateGearsCollection(baseCollection())).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })

  test('detects a duplicate gear code (case-insensitive)', () => {
    const collection = baseCollection({
      items: [
        baseCollection().items[0],
        {
          ...baseCollection().items[0],
          id: '55555555-5555-4555-8555-555555555555',
          code: 'otb'
        }
      ]
    })

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_business_code' })
      ])
    )
  })

  test('detects a duplicate category code', () => {
    const collection = baseCollection({
      categories: [
        { id: CATEGORY_ID, code: 'TOWED', name: 'Towed gear' },
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'towed',
          name: 'Duplicate'
        }
      ]
    })

    expect(validateGearsCollection(collection).valid).toBe(false)
  })

  test('detects a duplicate characteristic code', () => {
    const collection = baseCollection({
      characteristics: [
        baseCollection().characteristics[0],
        {
          ...baseCollection().characteristics[0],
          id: '77777777-7777-4777-8777-777777777777'
        }
      ]
    })

    expect(validateGearsCollection(collection).valid).toBe(false)
  })

  test('a category code matching a gear code is not a cross-namespace duplicate', () => {
    const collection = baseCollection({
      categories: [{ id: CATEGORY_ID, code: 'OTB', name: 'Towed gear' }]
    })

    expect(validateGearsCollection(collection).valid).toBe(true)
  })

  test('detects a missing category reference', () => {
    const collection = baseCollection()
    collection.items[0].categoryId = '99999999-9999-4999-8999-999999999999'

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'unresolved_reference',
        path: 'items[0].categoryId'
      })
    ])
  })

  test('detects a missing characteristic reference', () => {
    const collection = baseCollection()
    collection.items[0].applicableCharacteristics[0].characteristicId =
      '99999999-9999-4999-8999-999999999999'

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'unresolved_reference' })
    ])
  })

  test('accepts the approved "number" characteristic dataType', () => {
    expect(validateGearsCollection(baseCollection()).valid).toBe(true)
  })

  test('rejects an unsupported characteristic dataType', () => {
    const collection = baseCollection()
    collection.characteristics[0].dataType = 'string'

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'unsupported_characteristic_type' })
    ])
  })

  test('accepts a valid numeric range', () => {
    expect(validateGearsCollection(baseCollection()).valid).toBe(true)
  })

  test('rejects minValue greater than maxValue', () => {
    const collection = baseCollection()
    collection.characteristics[0].minValue = 500

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'invalid_numeric_range' })
    ])
  })

  test('requires at least one vessel-length applicability flag', () => {
    const collection = baseCollection()
    collection.items[0].applicableCharacteristics[0].vesselLengthApplicability =
      []

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'missing_applicability' })
    ])
  })

  test('rejects an unsupported vessel-length band value', () => {
    const collection = baseCollection()
    collection.items[0].applicableCharacteristics[0].vesselLengthApplicability =
      ['under-ten-metres']

    const result = validateGearsCollection(collection)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'invalid_enum_value',
        rejectedValue: 'under-ten-metres'
      })
    ])
  })

  test('preserves fixed and required as independent values', () => {
    const collection = baseCollection()
    collection.items[0].applicableCharacteristics[0].fixed = false
    collection.items[0].applicableCharacteristics[0].required = true

    expect(validateGearsCollection(collection).valid).toBe(true)
  })

  test('does not mutate the supplied collection', () => {
    const collection = baseCollection()
    const before = structuredClone(collection)

    validateGearsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('produces deterministic error ordering across multiple failures', () => {
    const invalid = baseCollection()
    invalid.items[0].categoryId = '99999999-9999-4999-8999-999999999999'
    invalid.characteristics[0].minValue = 500

    const first = validateGearsCollection(structuredClone(invalid))
    const second = validateGearsCollection(structuredClone(invalid))

    expect(first.errors).toEqual(second.errors)
  })

  test('tolerates missing categories/characteristics arrays and items with no applicableCharacteristics', () => {
    const collection = {
      items: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          code: 'OTB',
          name: 'Otter trawl',
          categoryId: CATEGORY_ID
        }
      ]
    }

    expect(() => validateGearsCollection(collection)).not.toThrow()
  })

  test('tolerates a null characteristic entry when checking numeric ranges', () => {
    const collection = baseCollection({
      characteristics: [null, ...baseCollection().characteristics]
    })

    expect(() => validateGearsCollection(collection)).not.toThrow()
  })
})
