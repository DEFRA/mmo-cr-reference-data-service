import { describe, expect, test } from 'vitest'

import { guidSchema } from './guid.js'

describe('#guidSchema', () => {
  test('accepts a valid UUID', () => {
    const { error } = guidSchema.validate(
      '73168db4-1996-46f8-91cb-2288fe2e689c'
    )

    expect(error).toBeUndefined()
  })

  test('rejects a non-UUID string', () => {
    const { error } = guidSchema.validate('not-a-guid')

    expect(error).toBeDefined()
  })

  test('rejects a business code used as a GUID substitute', () => {
    const { error } = guidSchema.validate('GBR000A1234')

    expect(error).toBeDefined()
  })
})
