import { describe, expect, test } from 'vitest'

import { parseIncludeFilter } from './manifest-include-filter.js'

describe('#parseIncludeFilter', () => {
  test('returns null when include is absent', () => {
    expect(parseIncludeFilter(undefined)).toBeNull()
  })

  test('rejects a non-string value (e.g. a repeated query parameter array)', () => {
    expect(() => parseIncludeFilter(['vessels', 'ports'])).toThrow(
      /must be a string/
    )
  })

  test('parses one dataset', () => {
    expect(parseIncludeFilter('vessels')).toEqual(['vessels'])
  })

  test('parses multiple datasets', () => {
    expect(parseIncludeFilter('vessels,ports,species')).toEqual([
      'vessels',
      'ports',
      'species'
    ])
  })

  test('parses every supported persisted dataset', () => {
    expect(
      parseIncludeFilter(
        'vessels,gears,ports,species,map-land,map-statistical-areas'
      )
    ).toHaveLength(6)
  })

  test('trims whitespace around separators', () => {
    expect(parseIncludeFilter(' vessels , ports ')).toEqual([
      'vessels',
      'ports'
    ])
  })

  test('de-duplicates repeated values', () => {
    expect(parseIncludeFilter('vessels,vessels,ports')).toEqual([
      'vessels',
      'ports'
    ])
  })

  test('is case-sensitive', () => {
    expect(() => parseIncludeFilter('Vessels')).toThrow(/Unsupported dataset/)
  })

  test('rejects an empty string', () => {
    expect(() => parseIncludeFilter('')).toThrow(/must not be empty/)
  })

  test('rejects an empty list member', () => {
    expect(() => parseIncludeFilter('vessels,,ports')).toThrow(/empty value/)
  })

  test('rejects an unsupported dataset', () => {
    expect(() => parseIncludeFilter('vessels,unknown')).toThrow(
      /Unsupported dataset/
    )
  })

  test('rejects map-ports (derived, never a manifest entry)', () => {
    expect(() => parseIncludeFilter('map-ports')).toThrow(/Unsupported dataset/)
  })

  test('rejects an alias instead of the canonical identifier', () => {
    expect(() => parseIncludeFilter('vessel')).toThrow(/Unsupported dataset/)
  })

  test('rejects an excessively long value', () => {
    expect(() => parseIncludeFilter('vessels'.repeat(50))).toThrow(
      /must not be empty or excessively long/
    )
  })

  test('rejects too many raw entries, even before de-duplication', () => {
    const tooMany = Array.from({ length: 7 }, () => 'vessels').join(',')
    expect(() => parseIncludeFilter(tooMany)).toThrow(/lists too many datasets/)
  })

  test('all thrown errors use the shared invalid_request code', () => {
    try {
      parseIncludeFilter('unknown')
      throw new Error('expected parseIncludeFilter to throw')
    } catch (error) {
      expect(error.code).toBe('invalid_request')
    }
  })
})
