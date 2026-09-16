import { describe, expect, test } from 'vitest'

import { isValidDateOrder } from './date-range-validation.js'

describe('#isValidDateOrder', () => {
  test('accepts an end date after the start date', () => {
    expect(
      isValidDateOrder({ startValue: '2020-01-01', endValue: '2020-01-02' })
    ).toBe(true)
  })

  test('accepts an end date equal to the start date', () => {
    expect(
      isValidDateOrder({ startValue: '2020-01-01', endValue: '2020-01-01' })
    ).toBe(true)
  })

  test('rejects an end date before the start date', () => {
    expect(
      isValidDateOrder({ startValue: '2020-01-02', endValue: '2020-01-01' })
    ).toBe(false)
  })

  test('accepts a missing end date', () => {
    expect(isValidDateOrder({ startValue: '2020-01-01', endValue: null })).toBe(
      true
    )
  })

  test('accepts a missing start date', () => {
    expect(isValidDateOrder({ startValue: null, endValue: '2020-01-01' })).toBe(
      true
    )
  })

  test('is independent of the local timezone for date-only values', () => {
    expect(
      isValidDateOrder({ startValue: '2020-06-01', endValue: '2020-06-01' })
    ).toBe(true)
  })

  test('does not throw for a malformed date value', () => {
    expect(() =>
      isValidDateOrder({ startValue: 'not-a-date', endValue: '2020-01-01' })
    ).not.toThrow()
  })
})
