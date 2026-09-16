import { describe, expect, test } from 'vitest'

import { convictValidateStrictBoolean } from './validate-strict-boolean.js'

describe('#convictValidateStrictBoolean', () => {
  test('Coerces "true" to true', () => {
    expect(convictValidateStrictBoolean.coerce('true')).toBe(true)
  })

  test('Coerces "false" to false', () => {
    expect(convictValidateStrictBoolean.coerce('false')).toBe(false)
  })

  test('Leaves an already-boolean value unchanged', () => {
    expect(convictValidateStrictBoolean.coerce(true)).toBe(true)
    expect(convictValidateStrictBoolean.coerce(false)).toBe(false)
  })

  test('Leaves an unrecognised value unchanged for validate to reject', () => {
    expect(convictValidateStrictBoolean.coerce('not-a-boolean')).toBe(
      'not-a-boolean'
    )
  })

  test('With a boolean value, should not throw', () => {
    expect(() => convictValidateStrictBoolean.validate(true)).not.toThrow()
    expect(() => convictValidateStrictBoolean.validate(false)).not.toThrow()
  })

  test('With an unrecognised string, should throw', () => {
    expect(() =>
      convictValidateStrictBoolean.validate('not-a-boolean')
    ).toThrow()
    expect(() => convictValidateStrictBoolean.validate('yes')).toThrow()
    expect(() => convictValidateStrictBoolean.validate('no')).toThrow()
    expect(() => convictValidateStrictBoolean.validate('1')).toThrow()
    expect(() => convictValidateStrictBoolean.validate('0')).toThrow()
    expect(() => convictValidateStrictBoolean.validate('')).toThrow()
  })
})
