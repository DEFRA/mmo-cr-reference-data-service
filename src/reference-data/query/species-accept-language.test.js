import { describe, expect, test } from 'vitest'

import { parseAcceptLanguageTag } from './species-accept-language.js'

describe('#parseAcceptLanguageTag', () => {
  test('returns null when the header is absent', () => {
    expect(parseAcceptLanguageTag(undefined)).toBeNull()
  })

  test.each([
    ['en-GB', 'en-GB'],
    ['cy-GB, en-GB;q=0.8, en;q=0.6', 'cy-GB'],
    ['en-GB;q=0.8', 'en-GB'],
    ['en;q=0.1, cy-GB;q=0.9', 'en'],
    ['  en-GB  ;q=0.8', 'en-GB'],
    ['en', 'en']
  ])('parses %j to %j', (rawHeader, expected) => {
    expect(parseAcceptLanguageTag(rawHeader)).toBe(expected)
  })

  test('does not apply regional fallback', () => {
    expect(parseAcceptLanguageTag('en')).not.toBe('en-GB')
  })

  test('rejects a header with no valid language tag', () => {
    expect(() => parseAcceptLanguageTag(';;;')).toThrow()
    expect(() => parseAcceptLanguageTag('123')).toThrow()
  })

  test('rejects an overlong header', () => {
    expect(() => parseAcceptLanguageTag('en-GB'.repeat(100))).toThrow()
  })

  test('does not include the raw header value in its error message', () => {
    const rawHeader = 'not-a-valid-tag-!!!'
    try {
      parseAcceptLanguageTag(rawHeader)
      throw new Error('expected to throw')
    } catch (error) {
      expect(error.message).not.toContain(rawHeader)
      expect(error.code).toBe('invalid_request')
    }
  })
})
