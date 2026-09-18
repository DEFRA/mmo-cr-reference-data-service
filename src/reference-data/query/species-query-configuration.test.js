import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { speciesQueryConfiguration } from './species-query-configuration.js'

function buildSpecies(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    faoCode: 'COD',
    scientificName: 'Gadus morhua',
    commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }],
    localNames: [
      { id: 'b', languageCode: 'en-GB', name: 'Cod', official: true }
    ],
    active: true,
    ...overrides
  }
}

function createService(species) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'species',
    { items: species },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  return createCollectionQueryService({ store })
}

describe('#speciesQueryConfiguration', () => {
  test('retrieves the full collection', () => {
    const result = createService([buildSpecies()]).queryCollection(
      speciesQueryConfiguration,
      {}
    )
    expect(result.totalCount).toBe(1)
  })

  test('canonical output preserves all common and local names, never leaks enrichment', () => {
    const result = createService([buildSpecies()]).queryCollection(
      speciesQueryConfiguration,
      {}
    )
    expect(result.items[0].commonNames).toHaveLength(1)
    expect(result.items[0].localNames).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty('_commonNamesText')
    expect(result.items[0]).not.toHaveProperty('_localNamesText')
  })

  describe('faoCode filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, { faoCode: 'COD' })
          .items
      ).toHaveLength(1)
      expect(
        service.queryCollection(speciesQueryConfiguration, { faoCode: 'cod' })
          .items
      ).toHaveLength(1)
    })

    test('does not match a partial value', () => {
      const result = createService([buildSpecies()]).queryCollection(
        speciesQueryConfiguration,
        { faoCode: 'CO' }
      )
      expect(result.items).toHaveLength(0)
    })

    test('does not mutate the canonical FAO code', () => {
      const result = createService([buildSpecies()]).queryCollection(
        speciesQueryConfiguration,
        { faoCode: 'cod' }
      )
      expect(result.items[0].faoCode).toBe('COD')
    })
  })

  describe('scientificName filter', () => {
    test('matches exactly, case-insensitively', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          scientificName: 'Gadus morhua'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          scientificName: 'gadus morhua'
        }).items
      ).toHaveLength(1)
    })

    test('does not match a partial value', () => {
      const result = createService([buildSpecies()]).queryCollection(
        speciesQueryConfiguration,
        { scientificName: 'Gadus' }
      )
      expect(result.items).toHaveLength(0)
    })
  })

  describe('countryCode filter', () => {
    test('matches when a commonNames entry has the requested country, case-insensitively', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          countryCode: 'GBR'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          countryCode: 'gbr'
        }).items
      ).toHaveLength(1)
    })

    test('excludes species without a matching country', () => {
      const result = createService([buildSpecies()]).queryCollection(
        speciesQueryConfiguration,
        { countryCode: 'FRA' }
      )
      expect(result.items).toHaveLength(0)
    })

    test('does not mutate canonical commonNames', () => {
      const species = buildSpecies()
      createService([species]).queryCollection(speciesQueryConfiguration, {
        countryCode: 'GBR'
      })
      expect(species.commonNames).toEqual([
        { id: 'a', countryCode: 'GBR', name: 'Cod' }
      ])
    })

    test('rejects an empty value', () => {
      expect(() =>
        createService([buildSpecies()]).queryCollection(
          speciesQueryConfiguration,
          { countryCode: '' }
        )
      ).toThrow(/must not be empty/)
    })

    test('rejects an overlong value', () => {
      expect(() =>
        createService([buildSpecies()]).queryCollection(
          speciesQueryConfiguration,
          { countryCode: 'a'.repeat(201) }
        )
      ).toThrow(/too long/)
    })
  })

  describe('languageCode filter', () => {
    test('matches the complete tag, case-insensitively', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          languageCode: 'en-GB'
        }).items
      ).toHaveLength(1)
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          languageCode: 'EN-gb'
        }).items
      ).toHaveLength(1)
    })

    test('does not apply regional fallback', () => {
      const result = createService([buildSpecies()]).queryCollection(
        speciesQueryConfiguration,
        { languageCode: 'en' }
      )
      expect(result.items).toHaveLength(0)
    })

    test('rejects an empty value', () => {
      expect(() =>
        createService([buildSpecies()]).queryCollection(
          speciesQueryConfiguration,
          { languageCode: '' }
        )
      ).toThrow(/must not be empty/)
    })

    test('rejects an overlong value', () => {
      expect(() =>
        createService([buildSpecies()]).queryCollection(
          speciesQueryConfiguration,
          { languageCode: 'a'.repeat(201) }
        )
      ).toThrow(/too long/)
    })
  })

  describe('general text search', () => {
    test('matches FAO code, scientific name, common names, and local names', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, { query: 'cod' })
          .items
      ).toHaveLength(1)
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          query: 'gadus'
        }).items
      ).toHaveLength(1)
    })

    test('does not match on GUID, country code alone, or language code alone', () => {
      const service = createService([buildSpecies()])
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          query: '11111111'
        }).items
      ).toHaveLength(0)
      expect(
        service.queryCollection(speciesQueryConfiguration, { query: 'GBR' })
          .items
      ).toHaveLength(0)
      expect(
        service.queryCollection(speciesQueryConfiguration, {
          query: 'en-GB'
        }).items
      ).toHaveLength(0)
    })
  })

  test('excludes inactive species by default', () => {
    const result = createService([
      buildSpecies({ active: false })
    ]).queryCollection(speciesQueryConfiguration, {})
    expect(result.totalCount).toBe(0)
  })

  test('mobile view resolves a display name using countryCode as the country context', () => {
    const species = buildSpecies({
      localNames: [],
      commonNames: [{ id: 'a', countryCode: 'FRA', name: 'Morue' }]
    })
    const result = createService([species]).queryCollection(
      speciesQueryConfiguration,
      { view: 'mobile', countryCode: 'FRA' }
    )
    expect(result.items[0].displayName).toBe('Morue')
  })

  test('combines filters using AND', () => {
    const service = createService([buildSpecies()])
    const result = service.queryCollection(speciesQueryConfiguration, {
      faoCode: 'COD',
      countryCode: 'FRA'
    })
    expect(result.items).toHaveLength(0)
  })

  test('rejects a non-string countryCode value (e.g. a repeated query parameter array)', () => {
    const service = createService([buildSpecies()])
    expect(() =>
      service.queryCollection(speciesQueryConfiguration, {
        countryCode: ['GBR', 'FRA']
      })
    ).toThrow(/must be a string/)
  })

  test('sorts by faoCode and scientificName', () => {
    const service = createService([
      buildSpecies(),
      buildSpecies({
        id: '22222222-2222-4222-8222-222222222222',
        faoCode: 'BSS',
        scientificName: 'Dicentrarchus labrax'
      })
    ])

    expect(
      service
        .queryCollection(speciesQueryConfiguration, { sort: 'faoCode' })
        .items.map((s) => s.faoCode)
    ).toEqual(['BSS', 'COD'])

    expect(
      service
        .queryCollection(speciesQueryConfiguration, {
          sort: 'scientificName'
        })
        .items.map((s) => s.scientificName)
    ).toEqual(['Dicentrarchus labrax', 'Gadus morhua'])
  })
})
