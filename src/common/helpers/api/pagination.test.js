import { describe, expect, test } from 'vitest'

import { parsePagination } from './pagination.js'

describe('#parsePagination', () => {
  test('applies defaults when nothing is supplied', () => {
    expect(parsePagination()).toEqual({ limit: 50, offset: 0 })
  })

  test('accepts a valid limit and offset', () => {
    expect(parsePagination({ limit: 10, offset: 20 })).toEqual({
      limit: 10,
      offset: 20
    })
  })

  test('rejects a limit above the configured maximum', () => {
    expect(() => parsePagination({ limit: 1000 })).toThrow(
      expect.objectContaining({ code: 'invalid_request' })
    )
  })

  test('rejects a negative limit', () => {
    expect(() => parsePagination({ limit: -1 })).toThrow()
  })

  test('rejects a non-integer limit', () => {
    expect(() => parsePagination({ limit: 1.5 })).toThrow()
  })

  test('rejects a negative offset', () => {
    expect(() => parsePagination({ offset: -1 })).toThrow()
  })

  test('rejects a non-integer offset', () => {
    expect(() => parsePagination({ offset: 1.5 })).toThrow()
  })

  test('respects a configurable maximum limit', () => {
    expect(parsePagination({ limit: 100 }, { maxLimit: 100 })).toEqual({
      limit: 100,
      offset: 0
    })
    expect(() => parsePagination({ limit: 101 }, { maxLimit: 100 })).toThrow()
  })
})
