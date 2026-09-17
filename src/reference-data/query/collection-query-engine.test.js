import { describe, expect, test } from 'vitest'

import { createQueryConfiguration } from './query-configuration.js'
import { runCollectionQuery } from './collection-query-engine.js'

const records = [
  { id: 'b-guid', name: 'Beta', code: 'B', active: true, length: 5 },
  { id: 'a-guid', name: 'Alpha', code: 'A', active: true, length: 12 },
  { id: 'c-guid', name: 'Charlie', code: 'C', active: false, length: 8 }
]

const config = createQueryConfiguration({
  dataset: 'vessels',
  format: 'json',
  getGuid: (r) => r.id,
  exactFilters: [
    { param: 'code', getValue: (r) => r.code, caseInsensitive: true }
  ],
  textSearchFields: [(r) => r.name],
  sortFields: { name: (r) => r.name, length: (r) => r.length },
  activeField: (r) => r.active,
  compositeFilters: [
    {
      name: 'lengthAtLeast',
      params: ['minLength'],
      parse: (rawQuery) => Number(rawQuery.minLength),
      predicate: (record, minLength) => record.length >= minLength
    }
  ]
})

function baseRequest(overrides = {}) {
  return {
    view: 'canonical',
    freeText: null,
    ids: null,
    exactFilters: {},
    customFilterValues: {},
    compositeFilterValues: {},
    includeInactive: false,
    sort: null,
    offset: 0,
    limit: 50,
    isFullCollectionRequest: true,
    ...overrides
  }
}

describe('#runCollectionQuery', () => {
  test('returns the full collection when isFullCollectionRequest is true', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest()
    })
    expect(result.totalCount).toBe(2)
    expect(result.items.map((r) => r.id)).toEqual(['a-guid', 'b-guid'])
    expect(result.offset).toBeUndefined()
  })

  test('excludes inactive records by default', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest()
    })
    expect(result.items.some((r) => r.id === 'c-guid')).toBe(false)
  })

  test('includes inactive records when includeInactive is true', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        includeInactive: true,
        isFullCollectionRequest: false
      })
    })
    expect(result.totalCount).toBe(3)
  })

  test('applies the ids filter', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        ids: ['a-guid'],
        isFullCollectionRequest: false
      })
    })
    expect(result.items.map((r) => r.id)).toEqual(['a-guid'])
  })

  test('unknown ids silently produce fewer results', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        ids: ['a-guid', 'unknown-guid'],
        isFullCollectionRequest: false
      })
    })
    expect(result.items.map((r) => r.id)).toEqual(['a-guid'])
  })

  test('applies exact filters case-insensitively', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        exactFilters: { code: 'a' },
        isFullCollectionRequest: false
      })
    })
    expect(result.items.map((r) => r.id)).toEqual(['a-guid'])
  })

  test('applies free-text search case-insensitively', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        freeText: 'BET',
        isFullCollectionRequest: false
      })
    })
    expect(result.items.map((r) => r.id)).toEqual(['b-guid'])
  })

  test('sorts deterministically ascending and descending', () => {
    const asc = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        sort: { field: 'length', direction: 'asc' }
      })
    })
    expect(asc.items.map((r) => r.id)).toEqual(['b-guid', 'a-guid'])

    const desc = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        sort: { field: 'length', direction: 'desc' }
      })
    })
    expect(desc.items.map((r) => r.id)).toEqual(['a-guid', 'b-guid'])
  })

  test('applies pagination for non-full-collection requests', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        offset: 1,
        limit: 1,
        isFullCollectionRequest: false
      })
    })
    expect(result.totalCount).toBe(2)
    expect(result.items).toHaveLength(1)
    expect(result.offset).toBe(1)
    expect(result.limit).toBe(1)
  })

  test('does not mutate the source records array', () => {
    const original = [...records]
    runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        sort: { field: 'length', direction: 'desc' }
      })
    })
    expect(records).toEqual(original)
  })

  test('offset beyond result count returns an empty page', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        offset: 100,
        limit: 10,
        isFullCollectionRequest: false
      })
    })
    expect(result.items).toEqual([])
    expect(result.totalCount).toBe(2)
  })

  test('applies a composite filter', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        compositeFilterValues: { lengthAtLeast: 10 },
        isFullCollectionRequest: false
      })
    })
    expect(result.items.map((r) => r.id)).toEqual(['a-guid'])
  })

  test('combines a composite filter with other filters using AND', () => {
    const result = runCollectionQuery({
      config,
      records,
      parsedRequest: baseRequest({
        freeText: 'Alpha',
        compositeFilterValues: { lengthAtLeast: 100 },
        isFullCollectionRequest: false
      })
    })
    expect(result.items).toEqual([])
  })
})
