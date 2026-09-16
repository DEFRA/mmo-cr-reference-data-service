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
    expect(parseCollectionQuery({}, config).compositeFilterValues).toEqual({})
  })

  test('parses once when every param is supplied', () => {
    const parsed = parseCollectionQuery(
      { latitude: '1', longitude: '2' },
      config
    )
    expect(parsed.compositeFilterValues.location).toEqual({
      latitude: 1,
      longitude: 2
    })
  })

  test('rejects a partially supplied composite filter', () => {
    expect(() => parseCollectionQuery({ latitude: '1' }, config)).toThrow(
      /must be supplied together/
    )
  })

  test('recognises composite filter params (not "unsupported")', () => {
    expect(() =>
      parseCollectionQuery({ latitude: '1', longitude: '2' }, config)
    ).not.toThrow()
  })
})

describe('#parseCollectionQuery', () => {
  test('defaults with no query params', () => {
    const parsed = parseCollectionQuery({}, config)
    expect(parsed.view).toBe('canonical')
    expect(parsed.freeText).toBeNull()
    expect(parsed.ids).toBeNull()
    expect(parsed.includeInactive).toBe(false)
    expect(parsed.isFullCollectionRequest).toBe(true)
  })

  test('view=canonical and view=mobile are accepted', () => {
    expect(parseCollectionQuery({ view: 'canonical' }, config).view).toBe(
      'canonical'
    )
    expect(parseCollectionQuery({ view: 'mobile' }, config).view).toBe('mobile')
  })

  test('unsupported view is rejected', () => {
    expect(() => parseCollectionQuery({ view: 'xml' }, config)).toThrow(
      /Unsupported view/
    )
  })

  test('free-text query parses and trims', () => {
    expect(parseCollectionQuery({ query: '  boat  ' }, config).freeText).toBe(
      'boat'
    )
  })

  test('empty query after trim is rejected', () => {
    expect(() => parseCollectionQuery({ query: '   ' }, config)).toThrow(
      /must not be empty/
    )
  })

  test('overlong query is rejected', () => {
    expect(() =>
      parseCollectionQuery({ query: 'a'.repeat(300) }, config)
    ).toThrow(/too long/)
  })

  test('parses and de-duplicates ids', () => {
    const guid1 = '11111111-1111-4111-8111-111111111111'
    const guid2 = '22222222-2222-4222-8222-222222222222'
    const parsed = parseCollectionQuery(
      { ids: `${guid1},${guid2},${guid1}` },
      config
    )
    expect(parsed.ids).toEqual([guid1, guid2])
  })

  test('rejects an invalid GUID in ids', () => {
    expect(() => parseCollectionQuery({ ids: 'not-a-guid' }, config)).toThrow(
      /invalid GUID/
    )
  })

  test('rejects empty list member in ids', () => {
    const guid = '11111111-1111-4111-8111-111111111111'
    expect(() => parseCollectionQuery({ ids: `${guid},` }, config)).toThrow(
      /empty value/
    )
  })

  test('parses exact filters, case-insensitive', () => {
    const parsed = parseCollectionQuery({ cfr: '  GBR123  ' }, config)
    expect(parsed.exactFilters).toEqual({ cfr: 'GBR123' })
  })

  test('rejects an empty exact filter value', () => {
    expect(() => parseCollectionQuery({ cfr: '' }, config)).toThrow(
      /must not be empty/
    )
  })

  test('parses custom filters via their parse function', () => {
    const parsed = parseCollectionQuery({ vesselLengthMetres: '8.5' }, config)
    expect(parsed.customFilterValues.vesselLengthMetres).toBe(8.5)
  })

  test('custom filter parse errors propagate', () => {
    expect(() =>
      parseCollectionQuery({ vesselLengthMetres: 'abc' }, config)
    ).toThrow()
  })

  test('parses includeInactive strictly', () => {
    expect(
      parseCollectionQuery({ includeInactive: 'true' }, config).includeInactive
    ).toBe(true)
    expect(
      parseCollectionQuery({ includeInactive: 'false' }, config).includeInactive
    ).toBe(false)
  })

  test('rejects an invalid includeInactive value', () => {
    expect(() =>
      parseCollectionQuery({ includeInactive: 'yes' }, config)
    ).toThrow(/includeInactive/)
  })

  test('parses ascending and descending sort', () => {
    expect(parseCollectionQuery({ sort: 'name' }, config).sort).toEqual({
      field: 'name',
      direction: 'asc'
    })
    expect(parseCollectionQuery({ sort: '-name' }, config).sort).toEqual({
      field: 'name',
      direction: 'desc'
    })
  })

  test('rejects an unsupported sort field', () => {
    expect(() => parseCollectionQuery({ sort: 'unknown' }, config)).toThrow(
      /Unsupported sort field/
    )
  })

  test('parses offset and limit as strict non-negative integers', () => {
    const parsed = parseCollectionQuery({ offset: '10', limit: '20' }, config)
    expect(parsed.offset).toBe(10)
    expect(parsed.limit).toBe(20)
  })

  test('rejects a negative offset', () => {
    expect(() => parseCollectionQuery({ offset: '-1' }, config)).toThrow(
      /non-negative integer/
    )
  })

  test('rejects a non-integer limit', () => {
    expect(() => parseCollectionQuery({ limit: '1.5' }, config)).toThrow(
      /non-negative integer/
    )
  })

  test('rejects a zero limit', () => {
    expect(() => parseCollectionQuery({ limit: '0' }, config)).toThrow(
      /greater than zero/
    )
  })

  test('rejects a limit above the configured maximum', () => {
    expect(() => parseCollectionQuery({ limit: '501' }, config)).toThrow(
      /must not exceed/
    )
  })

  test('rejects an unsupported query parameter', () => {
    expect(() => parseCollectionQuery({ unknownParam: 'x' }, config)).toThrow(
      /Unsupported query parameter/
    )
  })

  test('full collection request is true only when no non-view parameter is supplied', () => {
    expect(parseCollectionQuery({}, config).isFullCollectionRequest).toBe(true)
    expect(
      parseCollectionQuery({ view: 'mobile' }, config).isFullCollectionRequest
    ).toBe(true)
    expect(
      parseCollectionQuery({ query: 'x' }, config).isFullCollectionRequest
    ).toBe(false)
  })

  test('does not mutate the raw query object', () => {
    const rawQuery = { query: 'boat' }
    const clone = { ...rawQuery }
    parseCollectionQuery(rawQuery, config)
    expect(rawQuery).toEqual(clone)
  })

  test('every thrown error uses the shared invalid_request code', () => {
    try {
      parseCollectionQuery({ view: 'bad' }, config)
      throw new Error('expected to throw')
    } catch (error) {
      expect(error.code).toBe('invalid_request')
    }
  })
})
