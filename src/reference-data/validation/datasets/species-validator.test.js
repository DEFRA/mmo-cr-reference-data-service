import { describe, expect, test } from 'vitest'

import { validateSpeciesCollection } from './species-validator.js'

function speciesItem(overrides = {}) {
  return {
    id: 'da465aa5-abcf-443a-bc7e-62e78978bca7',
    faoCode: 'COD',
    scientificName: 'Gadus morhua',
    commonNames: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        countryCode: 'GBR',
        name: 'Cod'
      }
    ],
    localNames: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        languageCode: 'cy',
        name: 'Penfras',
        official: false
      }
    ],
    active: true,
    ...overrides
  }
}

describe('#validateSpeciesCollection', () => {
  test('accepts a valid collection', () => {
    expect(validateSpeciesCollection({ items: [speciesItem()] })).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })

  test('detects a duplicate FAO code (case-insensitive)', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem(),
        speciesItem({
          id: '33333333-3333-4333-8333-333333333333',
          faoCode: 'cod'
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_business_code' })
      ])
    )
  })

  test('detects a duplicate common-name GUID', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem(),
        speciesItem({
          id: '33333333-3333-4333-8333-333333333333',
          faoCode: 'HAD',
          commonNames: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              countryCode: 'GBR',
              name: 'Haddock'
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_guid' })
      ])
    )
  })

  test('detects a duplicate local-name GUID', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem(),
        speciesItem({
          id: '33333333-3333-4333-8333-333333333333',
          faoCode: 'HAD',
          localNames: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              languageCode: 'cy',
              name: 'Hadog',
              official: false
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(false)
  })

  test('a common-name GUID colliding with a local-name GUID is a duplicate (shared namespace)', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem({
          commonNames: [
            {
              id: 'aaaaaaaa-1111-4111-8111-111111111111',
              countryCode: 'GBR',
              name: 'Cod'
            }
          ],
          localNames: [
            {
              id: 'aaaaaaaa-1111-4111-8111-111111111111',
              languageCode: 'cy',
              name: 'Penfras',
              official: false
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'duplicate_guid' })
    ])
  })

  test('allows one official local name per species and language', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem({
          localNames: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              languageCode: 'cy',
              name: 'Penfras',
              official: true
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('rejects two official local names for the same species and language', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem({
          localNames: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              languageCode: 'cy',
              name: 'Penfras',
              official: true
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              languageCode: 'cy',
              name: 'Alternative',
              official: true
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'duplicate_official_name' })
    ])
  })

  test('allows official names for different languages', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem({
          localNames: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              languageCode: 'cy',
              name: 'Penfras',
              official: true
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              languageCode: 'gd',
              name: 'Trosg',
              official: true
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('allows official names for the same language belonging to different species', () => {
    const result = validateSpeciesCollection({
      items: [
        speciesItem({
          localNames: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              languageCode: 'cy',
              name: 'Penfras',
              official: true
            }
          ]
        }),
        speciesItem({
          id: '44444444-4444-4444-8444-444444444444',
          faoCode: 'HAD',
          commonNames: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              countryCode: 'GBR',
              name: 'Haddock'
            }
          ],
          localNames: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              languageCode: 'cy',
              name: 'Hadog',
              official: true
            }
          ]
        })
      ]
    })

    expect(result.valid).toBe(true)
  })

  test('does not mutate the supplied collection', () => {
    const collection = { items: [speciesItem()] }
    const before = structuredClone(collection)

    validateSpeciesCollection(collection)

    expect(collection).toEqual(before)
  })
})
