import { describe, expect, test } from 'vitest'

import { timestampSchema } from './timestamp.js'

describe('#timestampSchema', () => {
  test('accepts a valid UTC timestamp', () => {
    const { error } = timestampSchema.validate('2026-09-11T08:30:00Z')

    expect(error).toBeUndefined()
  })

  test('accepts a valid offset timestamp', () => {
    const { error } = timestampSchema.validate('2026-09-11T08:30:00+01:00')

    expect(error).toBeUndefined()
  })

  test('rejects a date-only value', () => {
    const { error } = timestampSchema.validate('2026-09-11')

    expect(error).toBeDefined()
  })

  test('rejects a non-timestamp string', () => {
    const { error } = timestampSchema.validate('not-a-timestamp')

    expect(error).toBeDefined()
  })
})
