import { describe, expect, test } from 'vitest'

import { normaliseSpeciesCollection } from './species-normaliser.js'
import validSpeciesCollection from '#/common/schemas/fixtures/valid/species.json' with { type: 'json' }

describe('#normaliseSpeciesCollection', () => {
  test('leaves an already-canonical collection unchanged', () => {
    const result = normaliseSpeciesCollection(validSpeciesCollection)
    expect(result.changed).toBe(false)
    expect(result.value).toEqual(validSpeciesCollection)
  })

  test('trims whitespace from nested common/local names, preserving all names and GUIDs', () => {
    const collection = structuredClone(validSpeciesCollection)
    collection.items[0].commonNames[0].name = '  Cod  '
    const originalNameId = collection.items[0].commonNames[0].id

    const result = normaliseSpeciesCollection(collection)

    expect(result.changed).toBe(true)
    expect(result.value.items[0].commonNames[0].name).toBe('Cod')
    expect(result.value.items[0].commonNames[0].id).toBe(originalNameId)
    expect(result.value.items[0].localNames).toHaveLength(1)
  })

  test('does not mutate the supplied collection', () => {
    const collection = structuredClone(validSpeciesCollection)
    collection.items[0].commonNames[0].name = '  Cod  '
    const before = structuredClone(collection)

    normaliseSpeciesCollection(collection)

    expect(collection).toEqual(before)
  })

  test('is idempotent', () => {
    const collection = structuredClone(validSpeciesCollection)
    collection.items[0].commonNames[0].name = '  Cod  '

    const first = normaliseSpeciesCollection(collection)
    const second = normaliseSpeciesCollection(first.value)

    expect(second.changed).toBe(false)
  })
})
