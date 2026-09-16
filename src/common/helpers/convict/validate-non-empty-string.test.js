import { describe, expect, test } from 'vitest'

import { convictValidateNonEmptyString } from './validate-non-empty-string.js'

describe('#convictValidateNonEmptyString', () => {
  test('With a non-empty string, should not throw', () => {
    expect(() =>
      convictValidateNonEmptyString.validate('eu-west-2')
    ).not.toThrow()
  })

  test('With an empty string, should throw', () => {
    expect(() => convictValidateNonEmptyString.validate('')).toThrow()
  })

  test('With a whitespace-only string, should throw', () => {
    expect(() => convictValidateNonEmptyString.validate('   ')).toThrow()
  })
})
