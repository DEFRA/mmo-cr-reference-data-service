import { describe, expect, test } from 'vitest'

import {
  matchesIfMatch,
  matchesIfNoneMatch,
  parseIfMatchCandidates
} from './conditional-request.js'

describe('#matchesIfNoneMatch', () => {
  test('matches an identical strong ETag', () => {
    expect(matchesIfNoneMatch('"abc123"', '"abc123"')).toBe(true)
  })

  test('matches a weak ETag against a strong resource ETag value', () => {
    expect(matchesIfNoneMatch('"abc123"', 'W/"abc123"')).toBe(true)
  })

  test('does not match a different ETag', () => {
    expect(matchesIfNoneMatch('"abc123"', '"different"')).toBe(false)
  })

  test('matches a wildcard', () => {
    expect(matchesIfNoneMatch('"abc123"', '*')).toBe(true)
  })

  test('matches one of several comma-separated ETags', () => {
    expect(matchesIfNoneMatch('"abc123"', '"one", "abc123", "two"')).toBe(true)
  })

  test('does not match when the header or ETag is missing', () => {
    expect(matchesIfNoneMatch(null, '"abc123"')).toBe(false)
    expect(matchesIfNoneMatch('"abc123"', undefined)).toBe(false)
  })
})

describe('#matchesIfMatch', () => {
  test('matches an identical ETag', () => {
    expect(matchesIfMatch('"abc123"', '"abc123"')).toBe(true)
  })

  test('matches a wildcard', () => {
    expect(matchesIfMatch('"abc123"', '*')).toBe(true)
  })

  test('does not match a stale ETag', () => {
    expect(matchesIfMatch('"abc123"', '"stale"')).toBe(false)
  })
})

describe('#parseIfMatchCandidates', () => {
  test('parses multiple comma-separated values', () => {
    expect(parseIfMatchCandidates('"one", "two"')).toEqual(['"one"', '"two"'])
  })

  test('returns an empty array for a missing header', () => {
    expect(parseIfMatchCandidates(undefined)).toEqual([])
  })
})
