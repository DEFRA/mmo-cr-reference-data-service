import { describe, expect, test } from 'vitest'

import { convictValidateNonNegativeInteger } from './validate-non-negative-integer.js'

describe('#convictValidateNonNegativeInteger', () => {
  test('With zero, should not throw', () => {
    expect(() => convictValidateNonNegativeInteger.validate(0)).not.toThrow()
  })

  test('With a positive integer, should not throw', () => {
    expect(() => convictValidateNonNegativeInteger.validate(3)).not.toThrow()
  })

  test('With a negative number, should throw', () => {
    expect(() => convictValidateNonNegativeInteger.validate(-1)).toThrow()
  })

  test('With a non-integer number, should throw', () => {
    expect(() => convictValidateNonNegativeInteger.validate(1.5)).toThrow()
  })

  test('coerces a numeric string env value to a number', () => {
    expect(convictValidateNonNegativeInteger.coerce('3')).toBe(3)
  })

  test('passes through a non-string value unchanged', () => {
    expect(convictValidateNonNegativeInteger.coerce(3)).toBe(3)
  })
})
