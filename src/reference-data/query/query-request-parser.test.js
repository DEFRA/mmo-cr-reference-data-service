import { describe, expect, test } from 'vitest'

import { createQueryConfiguration } from './query-configuration.js'
import { parseCollectionQuery } from './query-request-parser.js'

const config = createQueryConfiguration({
  dataset: 'vessels',
  format: 'json',
  getGuid: (r) => r.id,
  exactFilters: [
    { param: 'cfr', getValue: (r) => r.cfr, caseInsensitive: true }
  ],
  textSearchFields: [(r) => r.name],
  sortFields: { name: (r) => r.name },
  customFilters: {
    vesselLengthMetres: {
      parse: (raw) => {
        const value = Number(raw)
        if (!Number.isFinite(value)) throw new Error('bad')
        return value
      },
      predicate: () => true
    }
  },
  compositeFilters: [
    {
      name: 'location',
      params: ['latitude', 'longitude'],
      parse: (rawQuery) => ({
        latitude: Number(rawQuery.latitude),
        longitude: Number(rawQuery.longitude)
      }),
      predicate: () => true
    }
  ]
})

describe('#parseCollectionQuery composite filters', () => {
  test('is absent from compositeFilterValues when no param is supplied', () => {
    expect(parseCollectionQuery(config, {}).compositeFilterValues).toEqual({})
  })

  test('parses once when every param is supplied', () => {
    const parsed = parseCollectionQuery(config, {
      latitude: '1',
      longitude: '2'
    })
    expect(parsed.compositeFilterValues.location).toEqual({
      latitude: 1,
      longitude: 2
    })
  })

  test('rejects a partially supplied composite filter', () => {
    expect(() => parseCollectionQuery(config, { latitude: '1' })).toThrow(
      /must be supplied together/
    )
  })

  test('recognises composite filter params (not "unsupported")', () => {
    expect(() =>
      parseCollectionQuery(config, { latitude: '1', longitude: '2' })
    ).not.toThrow()
  })
})

describe('#parseCollectionQuery', () => {
  test('defaults with no query params', () => {
    const parsed = parseCollectionQuery(config, {})
    expect(parsed.view).toBe('canonical')
    expect(parsed.freeText).toBeNull()
    expect(parsed.ids).toBeNull()
    expect(parsed.includeInactive).toBe(false)
    expect(parsed.isFullCollectionRequest).toBe(true)
  })

  test('view=canonical and view=mobile are accepted', () => {
    expect(parseCollectionQuery(config, { view: 'canonical' }).view).toBe(
      'canonical'
    )
    expect(parseCollectionQuery(config, { view: 'mobile' }).view).toBe('mobile')
  })

  test('unsupported view is rejected', () => {
    expect(() => parseCollectionQuery(config, { view: 'xml' })).toThrow(
      /Unsupported view/
    )
  })

  test('free-text query parses and trims', () => {
    expect(parseCollectionQuery(config, { query: '  boat  ' }).freeText).toBe(
      'boat'
    )
  })

  test('empty query after trim is rejected', () => {
    expect(() => parseCollectionQuery(config, { query: '   ' })).toThrow(
      /must not be empty/
    )
  })

  test('overlong query is rejected', () => {
    expect(() =>
      parseCollectionQuery(config, { query: 'a'.repeat(300) })
    ).toThrow(/too long/)
  })

  test('parses and de-duplicates ids', () => {
    const guid1 = '11111111-1111-4111-8111-111111111111'
    const guid2 = '22222222-2222-4222-8222-222222222222'
    const parsed = parseCollectionQuery(config, {
      ids: `${guid1},${guid2},${guid1}`
    })
    expect(parsed.ids).toEqual([guid1, guid2])
  })

  test('rejects an invalid GUID in ids', () => {
    expect(() => parseCollectionQuery(config, { ids: 'not-a-guid' })).toThrow(
      /invalid GUID/
    )
  })

  test('rejects empty list member in ids', () => {
    const guid = '11111111-1111-4111-8111-111111111111'
    expect(() => parseCollectionQuery(config, { ids: `${guid},` })).toThrow(
      /empty value/
    )
  })

  test('parses exact filters, case-insensitive', () => {
    const parsed = parseCollectionQuery(config, { cfr: '  GBR123  ' })
    expect(parsed.exactFilters).toEqual({ cfr: 'GBR123' })
  })

  test('rejects an empty exact filter value', () => {
    expect(() => parseCollectionQuery(config, { cfr: '' })).toThrow(
      /must not be empty/
    )
  })

  test('parses custom filters via their parse function', () => {
    const parsed = parseCollectionQuery(config, { vesselLengthMetres: '8.5' })
    expect(parsed.customFilterValues.vesselLengthMetres).toBe(8.5)
  })

  test('custom filter parse errors propagate', () => {
    expect(() =>
      parseCollectionQuery(config, { vesselLengthMetres: 'abc' })
    ).toThrow()
  })

  test('parses includeInactive strictly', () => {
    expect(
      parseCollectionQuery(config, { includeInactive: 'true' }).includeInactive
    ).toBe(true)
    expect(
      parseCollectionQuery(config, { includeInactive: 'false' }).includeInactive
    ).toBe(false)
  })

  test('rejects an invalid includeInactive value', () => {
    expect(() =>
      parseCollectionQuery(config, { includeInactive: 'yes' })
    ).toThrow(/includeInactive/)
  })

  test('parses ascending and descending sort', () => {
    expect(parseCollectionQuery(config, { sort: 'name' }).sort).toEqual({
      field: 'name',
      direction: 'asc'
    })
    expect(parseCollectionQuery(config, { sort: '-name' }).sort).toEqual({
      field: 'name',
      direction: 'desc'
    })
  })

  test('rejects an unsupported sort field', () => {
    expect(() => parseCollectionQuery(config, { sort: 'unknown' })).toThrow(
      /Unsupported sort field/
    )
  })

  test('parses offset and limit as strict non-negative integers', () => {
    const parsed = parseCollectionQuery(config, { offset: '10', limit: '20' })
    expect(parsed.offset).toBe(10)
    expect(parsed.limit).toBe(20)
  })

  test('rejects a negative offset', () => {
    expect(() => parseCollectionQuery(config, { offset: '-1' })).toThrow(
      /non-negative integer/
    )
  })

  test('rejects a non-integer limit', () => {
    expect(() => parseCollectionQuery(config, { limit: '1.5' })).toThrow(
      /non-negative integer/
    )
  })

  test('rejects a zero limit', () => {
    expect(() => parseCollectionQuery(config, { limit: '0' })).toThrow(
      /greater than zero/
    )
  })

  test('rejects a limit above the configured maximum', () => {
    expect(() => parseCollectionQuery(config, { limit: '501' })).toThrow(
      /must not exceed/
    )
  })

  test('rejects an unsupported query parameter', () => {
    expect(() => parseCollectionQuery(config, { unknownParam: 'x' })).toThrow(
      /Unsupported query parameter/
    )
  })

  test('full collection request is true only when no non-view parameter is supplied', () => {
    expect(parseCollectionQuery(config, {}).isFullCollectionRequest).toBe(true)
    expect(
      parseCollectionQuery(config, { view: 'mobile' }).isFullCollectionRequest
    ).toBe(true)
    expect(
      parseCollectionQuery(config, { query: 'x' }).isFullCollectionRequest
    ).toBe(false)
  })

  test('does not mutate the raw query object', () => {
    const rawQuery = { query: 'boat' }
    const clone = { ...rawQuery }
    parseCollectionQuery(config, rawQuery)
    expect(rawQuery).toEqual(clone)
  })

  test('every thrown error uses the shared invalid_request code', () => {
    try {
      parseCollectionQuery(config, { view: 'bad' })
      throw new Error('expected to throw')
    } catch (error) {
      expect(error.code).toBe('invalid_request')
    }
  })
})
