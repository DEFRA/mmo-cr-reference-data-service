import { describe, expect, test } from 'vitest'

import {
  createReferenceIndex,
  referenceExists
} from './relationship-validation.js'

describe('#createReferenceIndex and #referenceExists', () => {
  test('resolves a reference present in the index', () => {
    const index = createReferenceIndex(
      [{ id: 'a' }, { id: 'b' }],
      (item) => item.id
    )

    expect(referenceExists(index, 'a')).toBe(true)
  })

  test('reports a missing reference', () => {
    const index = createReferenceIndex([{ id: 'a' }], (item) => item.id)

    expect(referenceExists(index, 'missing')).toBe(false)
  })

  test('treats an absent reference value as trivially resolved', () => {
    const index = createReferenceIndex([{ id: 'a' }], (item) => item.id)

    expect(referenceExists(index, null)).toBe(true)
    expect(referenceExists(index, undefined)).toBe(true)
  })

  test('ignores items whose key is null or undefined when building the index', () => {
    const index = createReferenceIndex(
      [{ id: null }, { id: undefined }, { id: 'a' }],
      (item) => item.id
    )

    expect(index.size).toBe(1)
    expect(referenceExists(index, 'a')).toBe(true)
  })
})
