import { describe, expect, test } from 'vitest'

import { convictValidateOptionalUrl } from './validate-optional-url.js'

describe('#convictValidateOptionalUrl', () => {
  test('With null value, should not throw', () => {
    expect(() => convictValidateOptionalUrl.validate(null)).not.toThrow()
  })

  test('With undefined value, should not throw', () => {
    expect(() => convictValidateOptionalUrl.validate(undefined)).not.toThrow()
  })

  test('With a valid http URL, should not throw', () => {
    expect(() =>
      convictValidateOptionalUrl.validate('http://floci:4566')
    ).not.toThrow()
  })

  test('With a valid https URL, should not throw', () => {
    expect(() =>
      convictValidateOptionalUrl.validate('https://auth.example.com')
    ).not.toThrow()
  })

  test('With an invalid URL, should throw', () => {
    expect(() => convictValidateOptionalUrl.validate('not-a-url')).toThrow()
  })

  test('With an unsupported scheme, should throw', () => {
    expect(() =>
      convictValidateOptionalUrl.validate('ftp://example.com')
    ).toThrow()
  })
})
