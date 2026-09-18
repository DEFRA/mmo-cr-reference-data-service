import { describe, expect, test } from 'vitest'

import { convictValidatePositiveInteger } from './validate-positive-integer.js'

describe('#convictValidatePositiveInteger', () => {
  test('With a positive integer, should not throw', () => {
    expect(() => convictValidatePositiveInteger.validate(60000)).not.toThrow()
  })

  test('With zero, should throw', () => {
    expect(() => convictValidatePositiveInteger.validate(0)).toThrow()
  })

  test('With a negative number, should throw', () => {
    expect(() => convictValidatePositiveInteger.validate(-1)).toThrow()
  })

  test('With a non-integer number, should throw', () => {
    expect(() => convictValidatePositiveInteger.validate(1.5)).toThrow()
  })

  test('coerces a numeric string env value to a number', () => {
    expect(convictValidatePositiveInteger.coerce('60000')).toBe(60000)
  })

  test('passes through a non-string value unchanged', () => {
    expect(convictValidatePositiveInteger.coerce(60000)).toBe(60000)
  })
})
