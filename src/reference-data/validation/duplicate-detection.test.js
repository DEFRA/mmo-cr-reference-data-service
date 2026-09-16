import { describe, expect, test } from 'vitest'

import { findDuplicates } from './duplicate-detection.js'

describe('#findDuplicates', () => {
  test('returns no duplicates for unique values', () => {
    const entries = [
      { value: 'A', path: 'items[0].code' },
      { value: 'B', path: 'items[1].code' }
    ]

    expect(findDuplicates(entries)).toEqual([])
  })

  test('detects a duplicate group', () => {
    const entries = [
      { value: 'A', path: 'items[0].code' },
      { value: 'A', path: 'items[1].code' }
    ]

    const duplicates = findDuplicates(entries)

    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].value).toBe('A')
    expect(duplicates[0].entries).toHaveLength(2)
  })

  test('detects multiple independent duplicate groups in one pass', () => {
    const entries = [
      { value: 'A', path: 'items[0].code' },
      { value: 'A', path: 'items[1].code' },
      { value: 'B', path: 'items[2].code' },
      { value: 'B', path: 'items[3].code' }
    ]

    expect(findDuplicates(entries)).toHaveLength(2)
  })

  test('ignores null, undefined, and empty-string values', () => {
    const entries = [
      { value: null, path: 'items[0].code' },
      { value: undefined, path: 'items[1].code' },
      { value: '', path: 'items[2].code' }
    ]

    expect(findDuplicates(entries)).toEqual([])
  })

  test('is case-sensitive by default', () => {
    const entries = [
      { value: 'ABC', path: 'items[0].code' },
      { value: 'abc', path: 'items[1].code' }
    ]

    expect(findDuplicates(entries)).toEqual([])
  })

  test('supports case-insensitive comparison', () => {
    const entries = [
      { value: 'ABC', path: 'items[0].code' },
      { value: 'abc', path: 'items[1].code' }
    ]

    expect(findDuplicates(entries, { caseInsensitive: true })).toHaveLength(1)
  })

  test('does not mutate the supplied entries', () => {
    const entries = Object.freeze([
      Object.freeze({ value: 'A', path: 'items[0].code' }),
      Object.freeze({ value: 'A', path: 'items[1].code' })
    ])

    expect(() => findDuplicates(entries)).not.toThrow()
  })
})
