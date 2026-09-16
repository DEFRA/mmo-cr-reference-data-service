import { describe, expect, test } from 'vitest'

import { dateOnlySchema } from './date.js'

describe('#dateOnlySchema', () => {
  test('accepts a valid full-date', () => {
    const { error } = dateOnlySchema.validate('2015-03-17')

    expect(error).toBeUndefined()
  })

  test('rejects a value with a time component', () => {
    const { error } = dateOnlySchema.validate('2015-03-17T00:00:00Z')

    expect(error).toBeDefined()
  })

  test('rejects a non-date string', () => {
    const { error } = dateOnlySchema.validate('not-a-date')

    expect(error).toBeDefined()
  })
})
