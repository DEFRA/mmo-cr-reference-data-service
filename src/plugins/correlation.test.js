import { describe, expect, test } from 'vitest'

import { resolveCorrelationId } from './correlation.js'

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('#resolveCorrelationId', () => {
  test('preserves a valid supplied value', () => {
    expect(resolveCorrelationId('abc-123_XYZ')).toBe('abc-123_XYZ')
  })

  test('generates a value when none is supplied', () => {
    expect(resolveCorrelationId(undefined)).toMatch(GUID_PATTERN)
  })

  test('generates a value for an invalid supplied value (contains spaces)', () => {
    expect(resolveCorrelationId('has spaces')).toMatch(GUID_PATTERN)
  })

  test('generates a value for a non-string supplied value', () => {
    expect(resolveCorrelationId(42)).toMatch(GUID_PATTERN)
  })

  test('generates a different value than a rejected input each time', () => {
    const first = resolveCorrelationId('')
    const second = resolveCorrelationId('')
    expect(first).not.toBe(second)
  })
})
