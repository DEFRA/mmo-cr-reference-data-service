import { describe, expect, test } from 'vitest'

import { normalisePortsCollection } from './ports-normaliser.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

describe('#normalisePortsCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normalisePortsCollection(validPortsCollection)
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validPortsCollection)
  })

  test('trims whitespace from a port code while preserving leading zeros elsewhere', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '

    const result = normalisePortsCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.items[0].code).toBe('GBPLY')
  })

  test('never swaps, infers, or clamps coordinates', () => {
    const result = normalisePortsCollection(
      structuredClone(validPortsCollection)
    )
    expect(result.value.items[0].coordinate).toEqual(
      validPortsCollection.items[0].coordinate
    )
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '
    const before = structuredClone(collection)

    normalisePortsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '

    const first = normalisePortsCollection(collection)
    const second = normalisePortsCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
