import { describe, expect, test } from 'vitest'

import { normaliseGearsCollection } from './gears-normaliser.js'
import validGearsCollection from '#/common/schemas/fixtures/valid/gears.json' with { type: 'json' }

describe('#normaliseGearsCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normaliseGearsCollection(validGearsCollection)
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validGearsCollection)
  })

  test('trims whitespace from gear/category codes while preserving relationship GUIDs', () => {
    const collection = structuredClone(validGearsCollection)
    const originalCategoryId = collection.categories[0].id
    collection.categories[0].code = '  TOWED  '
    collection.items[0].code = '  OTB  '

    const result = normaliseGearsCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.categories[0].code).toBe('TOWED')
    expect(result.value.items[0].code).toBe('OTB')
    expect(result.value.categories[0].id).toBe(originalCategoryId)
    expect(result.value.items[0].categoryId).toBe(originalCategoryId)
  })

  test('preserves fixed/required booleans and numeric limits untouched', () => {
    const result = normaliseGearsCollection(
      structuredClone(validGearsCollection)
    )
    expect(result.value.items[0].applicableCharacteristics[0].fixed).toBe(true)
    expect(result.value.items[0].applicableCharacteristics[0].required).toBe(
      false
    )
    expect(result.value.characteristics[0].minValue).toBe(20)
    expect(result.value.characteristics[0].maxValue).toBe(300)
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validGearsCollection)
    collection.items[0].code = '  OTB  '
    const before = structuredClone(collection)

    normaliseGearsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validGearsCollection)
    collection.items[0].code = '  OTB  '

    const first = normaliseGearsCollection(collection)
    const second = normaliseGearsCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
