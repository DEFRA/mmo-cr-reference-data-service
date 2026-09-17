import { describe, expect, test } from 'vitest'

import { createQueryConfiguration } from './query-configuration.js'

const BASE = {
  dataset: 'vessels',
  format: 'json',
  getGuid: (record) => record.id
}

describe('#createQueryConfiguration', () => {
  test('creates a minimal valid configuration', () => {
    const config = createQueryConfiguration(BASE)
    expect(config.dataset).toBe('vessels')
    expect(config.pagination.defaultLimit).toBe(50)
    expect(config.pagination.maxLimit).toBe(500)
  })

  test('rejects a missing dataset', () => {
    expect(() => createQueryConfiguration({ ...BASE, dataset: '' })).toThrow(
      /dataset/
    )
  })

  test('rejects an unsupported format', () => {
    expect(() => createQueryConfiguration({ ...BASE, format: 'xml' })).toThrow(
      /format/
    )
  })

  test('rejects a missing getGuid', () => {
    expect(() =>
      createQueryConfiguration({ ...BASE, getGuid: undefined })
    ).toThrow(/getGuid/)
  })

  test('rejects duplicate exact filter param names', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        exactFilters: [
          { param: 'code', getValue: (r) => r.code },
          { param: 'code', getValue: (r) => r.code }
        ]
      })
    ).toThrow(/Duplicate/)
  })

  test('rejects a custom filter conflicting with an exact filter param', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        exactFilters: [{ param: 'code', getValue: (r) => r.code }],
        customFilters: { code: { parse: (v) => v, predicate: () => true } }
      })
    ).toThrow(/conflict/)
  })

  test('is frozen and immutable', () => {
    const config = createQueryConfiguration(BASE)
    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.exactFilters)).toBe(true)
  })

  test('creates a valid composite filter', () => {
    const config = createQueryConfiguration({
      ...BASE,
      compositeFilters: [
        {
          name: 'location',
          params: ['latitude', 'longitude'],
          parse: (rawQuery) => rawQuery,
          predicate: () => true
        }
      ]
    })
    expect(config.compositeFilters).toHaveLength(1)
    expect(Object.isFrozen(config.compositeFilters)).toBe(true)
  })

  test('rejects duplicate composite filter names', () => {
    const filter = {
      name: 'location',
      params: ['latitude'],
      parse: (v) => v,
      predicate: () => true
    }
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        compositeFilters: [filter, { ...filter, params: ['longitude'] }]
      })
    ).toThrow(/Duplicate/)
  })

  test('rejects a composite filter with an empty params array', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        compositeFilters: [
          {
            name: 'location',
            params: [],
            parse: (v) => v,
            predicate: () => true
          }
        ]
      })
    ).toThrow(/non-empty array/)
  })

  test('rejects a composite filter missing parse or predicate', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        compositeFilters: [
          { name: 'location', params: ['latitude'], predicate: () => true }
        ]
      })
    ).toThrow(/parse/)
  })

  test('rejects a composite filter param colliding with an exact filter param', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        exactFilters: [{ param: 'latitude', getValue: (r) => r.latitude }],
        compositeFilters: [
          {
            name: 'location',
            params: ['latitude'],
            parse: (v) => v,
            predicate: () => true
          }
        ]
      })
    ).toThrow(/conflicts with an existing filter param/)
  })

  test('rejects a composite filter param colliding with another composite filter', () => {
    expect(() =>
      createQueryConfiguration({
        ...BASE,
        compositeFilters: [
          {
            name: 'a',
            params: ['latitude'],
            parse: (v) => v,
            predicate: () => true
          },
          {
            name: 'b',
            params: ['latitude'],
            parse: (v) => v,
            predicate: () => true
          }
        ]
      })
    ).toThrow(/conflicts with an existing filter param/)
  })

  test('applies pagination overrides', () => {
    const config = createQueryConfiguration({
      ...BASE,
      pagination: { defaultLimit: 10, maxLimit: 20, allowPagination: false }
    })
    expect(config.pagination).toEqual({
      defaultLimit: 10,
      maxLimit: 20,
      allowPagination: false
    })
  })
})
