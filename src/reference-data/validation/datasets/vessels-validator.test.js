import { describe, expect, test } from 'vitest'

import { validateVesselsCollection } from './vessels-validator.js'

function baseVessel(overrides = {}) {
  return {
    id: '73168db4-1996-46f8-91cb-2288fe2e689c',
    name: 'ACHILLES',
    identifiers: {
      cfr: 'GBR000A1234',
      uvi: null,
      mmsi: '232001234',
      ircs: 'MABC7',
      externalMark: 'PH1234',
      registrationNumber: 'PH1234'
    },
    activeFrom: '2015-03-17',
    activeTo: null,
    ...overrides
  }
}

function collectionOf(items) {
  return { items }
}

describe('#validateVesselsCollection', () => {
  test('accepts a vessel with a supported natural identifier', () => {
    const result = validateVesselsCollection(collectionOf([baseVessel()]))
    expect(result).toEqual({ valid: true, errors: [], warnings: [] })
  })

  test('rejects a vessel with no natural identifier', () => {
    const result = validateVesselsCollection(
      collectionOf([
        baseVessel({
          identifiers: {
            cfr: null,
            uvi: null,
            mmsi: null,
            ircs: null,
            externalMark: null,
            registrationNumber: null
          }
        })
      ])
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'missing_natural_identifier' })
    ])
  })

  test('does not treat vessel name as a substitute natural identifier', () => {
    const result = validateVesselsCollection(
      collectionOf([
        baseVessel({
          name: 'ACHILLES',
          identifiers: {
            cfr: null,
            uvi: null,
            mmsi: null,
            ircs: null,
            externalMark: null,
            registrationNumber: null
          }
        })
      ])
    )
    expect(result.valid).toBe(false)
  })

  test.each(['cfr', 'uvi', 'ircs', 'externalMark', 'registrationNumber'])(
    'detects a case-insensitive duplicate %s',
    (field) => {
      const emptyIdentifiers = {
        cfr: null,
        uvi: null,
        mmsi: null,
        ircs: null,
        externalMark: null,
        registrationNumber: null
      }
      const first = baseVessel({
        id: '11111111-1111-4111-8111-111111111111',
        identifiers: { ...emptyIdentifiers, [field]: 'ABC123' }
      })
      const second = baseVessel({
        id: '22222222-2222-4222-8222-222222222222',
        identifiers: { ...emptyIdentifiers, [field]: 'abc123' }
      })

      const result = validateVesselsCollection(collectionOf([first, second]))

      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'duplicate_business_code',
          context: expect.objectContaining({ field })
        })
      ])
    }
  )

  test('MMSI duplicates are compared case-sensitively (exact)', () => {
    const emptyIdentifiers = {
      cfr: null,
      uvi: null,
      mmsi: null,
      ircs: null,
      externalMark: null,
      registrationNumber: null
    }
    const first = baseVessel({
      id: '11111111-1111-4111-8111-111111111111',
      identifiers: { ...emptyIdentifiers, mmsi: '232001234' }
    })
    const second = baseVessel({
      id: '22222222-2222-4222-8222-222222222222',
      identifiers: { ...emptyIdentifiers, mmsi: '232001234' }
    })

    const result = validateVesselsCollection(collectionOf([first, second]))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (issue) =>
          issue.code === 'duplicate_business_code' &&
          issue.context.field === 'mmsi'
      )
    ).toBe(true)
  })

  test('absent optional identifiers are never treated as duplicates', () => {
    const emptyIdentifiers = {
      cfr: null,
      uvi: null,
      mmsi: null,
      ircs: null,
      externalMark: null,
      registrationNumber: null
    }
    const first = baseVessel({
      id: '11111111-1111-4111-8111-111111111111',
      identifiers: { ...emptyIdentifiers, cfr: 'GBR000A1234' }
    })
    const second = baseVessel({
      id: '22222222-2222-4222-8222-222222222222',
      identifiers: { ...emptyIdentifiers, cfr: 'GBR000A5678' }
    })

    const result = validateVesselsCollection(collectionOf([first, second]))
    expect(result.valid).toBe(true)
  })

  test('accepts a valid active date range', () => {
    const result = validateVesselsCollection(
      collectionOf([
        baseVessel({ activeFrom: '2020-01-01', activeTo: '2021-01-01' })
      ])
    )
    expect(result.valid).toBe(true)
  })

  test('rejects activeTo before activeFrom', () => {
    const result = validateVesselsCollection(
      collectionOf([
        baseVessel({ activeFrom: '2021-01-01', activeTo: '2020-01-01' })
      ])
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'invalid_date_range' })
    ])
  })

  test('does not mutate the supplied collection', () => {
    const collection = collectionOf([baseVessel()])
    const before = structuredClone(collection)

    validateVesselsCollection(collection)

    expect(collection).toEqual(before)
  })

  test('produces deterministic error ordering across multiple failures', () => {
    const invalid = collectionOf([
      baseVessel({
        id: '11111111-1111-4111-8111-111111111111',
        activeFrom: '2021-01-01',
        activeTo: '2020-01-01'
      })
    ])

    const first = validateVesselsCollection(structuredClone(invalid))
    const second = validateVesselsCollection(structuredClone(invalid))

    expect(first.errors).toEqual(second.errors)
  })
})
