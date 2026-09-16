import { describe, expect, test } from 'vitest'

import { calculateChecksum, normaliseEtag } from './checksum.js'

describe('#calculateChecksum', () => {
  test('identical content produces the same checksum', () => {
    expect(calculateChecksum('{"a":1}')).toBe(calculateChecksum('{"a":1}'))
  })

  test('different content produces a different checksum', () => {
    expect(calculateChecksum('{"a":1}')).not.toBe(calculateChecksum('{"a":2}'))
  })
})

describe('#normaliseEtag', () => {
  test('strips surrounding quotes', () => {
    expect(normaliseEtag('"abc123"')).toBe('abc123')
  })

  test('returns null for a non-string value', () => {
    expect(normaliseEtag(undefined)).toBeNull()
  })

  test('an S3 ETag is not treated as a guaranteed content checksum', () => {
    const checksum = calculateChecksum('{"a":1}')
    const etag = normaliseEtag('"not-the-checksum"')
    expect(etag).not.toBe(checksum)
  })
})
