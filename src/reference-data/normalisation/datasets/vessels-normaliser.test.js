import { describe, expect, test } from 'vitest'

import { normaliseVesselsCollection } from './vessels-normaliser.js'
import validVesselsCollection from '#/common/schemas/fixtures/valid/vessels.json' with { type: 'json' }

describe('#normaliseVesselsCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normaliseVesselsCollection(validVesselsCollection)
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validVesselsCollection)
  })

  test('trims whitespace from vessel name and identifiers, preserving the GUID exactly', () => {
    const collection = structuredClone(validVesselsCollection)
    const originalId = collection.items[0].id
    collection.items[0].name = '  ACHILLES  '
    collection.items[0].identifiers.cfr = ' GBR000A1234 '

    const result = normaliseVesselsCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.items[0].name).toBe('ACHILLES')
    expect(result.value.items[0].identifiers.cfr).toBe('GBR000A1234')
    expect(result.value.items[0].id).toBe(originalId)
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validVesselsCollection)
    collection.items[0].name = '  ACHILLES  '
    const before = structuredClone(collection)

    normaliseVesselsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validVesselsCollection)
    collection.items[0].name = '  ACHILLES  '

    const first = normaliseVesselsCollection(collection)
    const second = normaliseVesselsCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
