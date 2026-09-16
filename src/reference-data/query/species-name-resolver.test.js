import { describe, expect, test } from 'vitest'

import { resolveSpeciesDisplayName } from './species-name-resolver.js'

function buildSpecies(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    faoCode: 'COD',
    scientificName: 'Gadus morhua',
    commonNames: [],
    localNames: [],
    active: true,
    ...overrides
  }
}

describe('#resolveSpeciesDisplayName', () => {
  describe('Rule 1: official local name matching requested language', () => {
    test('is selected when present', () => {
      const species = buildSpecies({
        localNames: [
          {
            id: 'a',
            languageCode: 'cy-GB',
            name: 'Cod Cymraeg',
            official: true
          }
        ]
      })
      expect(
        resolveSpeciesDisplayName(species, { requestedLanguageTag: 'cy-GB' })
      ).toBe('Cod Cymraeg')
    })

    test('matches case-insensitively', () => {
      const species = buildSpecies({
        localNames: [
          {
            id: 'a',
            languageCode: 'cy-GB',
            name: 'Cod Cymraeg',
            official: true
          }
        ]
      })
      expect(
        resolveSpeciesDisplayName(species, { requestedLanguageTag: 'CY-gb' })
      ).toBe('Cod Cymraeg')
    })

    test('a non-official local name in the requested language is not selected at Rule 1', () => {
      const species = buildSpecies({
        localNames: [
          {
            id: 'a',
            languageCode: 'cy-GB',
            name: 'Unofficial',
            official: false
          }
        ],
        commonNames: [{ id: 'b', countryCode: 'GBR', name: 'Fallback' }]
      })
      expect(
        resolveSpeciesDisplayName(species, { requestedLanguageTag: 'cy-GB' })
      ).toBe('Fallback')
    })

    test('a local name in another language is not selected', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'fr-FR', name: 'Morue', official: true }
        ]
      })
      expect(
        resolveSpeciesDisplayName(species, { requestedLanguageTag: 'cy-GB' })
      ).toBe('Gadus morhua')
    })
  })

  describe('Rule 2: common name matching requested country', () => {
    test('is selected when Rule 1 has no match', () => {
      const species = buildSpecies({
        commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }]
      })
      expect(resolveSpeciesDisplayName(species, { countryCode: 'GBR' })).toBe(
        'Cod'
      )
    })

    test('matches case-insensitively', () => {
      const species = buildSpecies({
        commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }]
      })
      expect(resolveSpeciesDisplayName(species, { countryCode: 'gbr' })).toBe(
        'Cod'
      )
    })

    test('a common name from another country is not selected at Rule 2 (falls through to Rule 4)', () => {
      const species = buildSpecies({
        commonNames: [{ id: 'a', countryCode: 'FRA', name: 'Morue' }]
      })
      // Rule 2 does not match GBR, but Rule 4 ("first available country common
      // name in canonical source order") still resolves via the same array.
      expect(resolveSpeciesDisplayName(species, { countryCode: 'GBR' })).toBe(
        'Morue'
      )
    })

    test('Rule 1 takes precedence over Rule 2', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'cy-GB', name: 'FromRule1', official: true }
        ],
        commonNames: [{ id: 'b', countryCode: 'GBR', name: 'FromRule2' }]
      })
      expect(
        resolveSpeciesDisplayName(species, {
          requestedLanguageTag: 'cy-GB',
          countryCode: 'GBR'
        })
      ).toBe('FromRule1')
    })
  })

  describe('Rule 3: official en-GB local name', () => {
    test('is selected when Rules 1 and 2 fail', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'en-GB', name: 'Cod', official: true }
        ]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Cod')
    })

    test('matches en-GB case-insensitively', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'EN-gb', name: 'Cod', official: true }
        ]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Cod')
    })

    test('a non-official en-GB local name does not satisfy Rule 3', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'en-GB', name: 'Cod', official: false }
        ],
        commonNames: [{ id: 'b', countryCode: 'GBR', name: 'Fallback' }]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Fallback')
    })

    test('a requested-country common name takes precedence over en-GB', () => {
      const species = buildSpecies({
        localNames: [
          { id: 'a', languageCode: 'en-GB', name: 'FromRule3', official: true }
        ],
        commonNames: [{ id: 'b', countryCode: 'GBR', name: 'FromRule2' }]
      })
      expect(resolveSpeciesDisplayName(species, { countryCode: 'GBR' })).toBe(
        'FromRule2'
      )
    })
  })

  describe('Rule 4: first available country common name', () => {
    test('is selected when Rules 1-3 fail', () => {
      const species = buildSpecies({
        commonNames: [
          { id: 'a', countryCode: 'FRA', name: 'Morue' },
          { id: 'b', countryCode: 'ESP', name: 'Bacalao' }
        ]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Morue')
    })

    test('preserves canonical source order as the tie-breaker', () => {
      const species = buildSpecies({
        commonNames: [
          { id: 'b', countryCode: 'ESP', name: 'Bacalao' },
          { id: 'a', countryCode: 'FRA', name: 'Morue' }
        ]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Bacalao')
    })

    test('scientific name is not selected while a common name exists', () => {
      const species = buildSpecies({
        commonNames: [{ id: 'a', countryCode: 'FRA', name: 'Morue' }]
      })
      expect(resolveSpeciesDisplayName(species, {})).toBe('Morue')
    })
  })

  describe('Rule 5: scientific name', () => {
    test('is selected when no local or common name exists', () => {
      expect(resolveSpeciesDisplayName(buildSpecies(), {})).toBe('Gadus morhua')
    })

    test('FAO code is not selected while scientific name exists', () => {
      expect(resolveSpeciesDisplayName(buildSpecies(), {})).not.toBe('COD')
    })
  })

  describe('Rule 6: FAO code', () => {
    test('is selected when no name or scientific name exists', () => {
      const species = buildSpecies({ scientificName: '' })
      expect(resolveSpeciesDisplayName(species, {})).toBe('COD')
    })
  })

  test('does not mutate the canonical species or its nested arrays', () => {
    const species = buildSpecies({
      localNames: [
        { id: 'a', languageCode: 'en-GB', name: 'Cod', official: true }
      ],
      commonNames: [
        { id: 'b', countryCode: 'ESP', name: 'Bacalao' },
        { id: 'c', countryCode: 'FRA', name: 'Morue' }
      ]
    })
    const clone = JSON.parse(JSON.stringify(species))
    resolveSpeciesDisplayName(species, {
      requestedLanguageTag: 'en-GB',
      countryCode: 'FRA'
    })
    expect(species).toEqual(clone)
  })

  test('is deterministic for the same species and context', () => {
    const species = buildSpecies({
      commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }]
    })
    const context = { countryCode: 'GBR' }
    expect(resolveSpeciesDisplayName(species, context)).toBe(
      resolveSpeciesDisplayName(species, context)
    )
  })

  test('remains deterministic against malformed data with multiple official local names', () => {
    const species = buildSpecies({
      localNames: [
        { id: 'a', languageCode: 'en-GB', name: 'First', official: true },
        { id: 'b', languageCode: 'en-GB', name: 'Second', official: true }
      ]
    })
    expect(resolveSpeciesDisplayName(species, {})).toBe('First')
  })
})
