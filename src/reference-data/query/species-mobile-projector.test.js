import { describe, expect, test } from 'vitest'

import { projectSpeciesToMobile } from './species-mobile-projector.js'

const SPECIES = {
  id: '11111111-1111-4111-8111-111111111111',
  faoCode: 'COD',
  scientificName: 'Gadus morhua',
  commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }],
  localNames: [
    { id: 'b', languageCode: 'en-GB', name: 'Official Cod', official: true }
  ],
  active: true
}

describe('#projectSpeciesToMobile', () => {
  test('preserves GUID, FAO code, and scientific name', () => {
    const mobile = projectSpeciesToMobile(SPECIES, {})
    expect(mobile.id).toBe(SPECIES.id)
    expect(mobile.faoCode).toBe('COD')
    expect(mobile.scientificName).toBe('Gadus morhua')
  })

  test('resolves one deterministic display name via the resolver', () => {
    const mobile = projectSpeciesToMobile(SPECIES, {
      requestedLanguageTag: 'en-GB'
    })
    expect(mobile.displayName).toBe('Official Cod')
  })

  test('does not expose complete common/local name arrays', () => {
    const mobile = projectSpeciesToMobile(SPECIES, {})
    expect(mobile).not.toHaveProperty('commonNames')
    expect(mobile).not.toHaveProperty('localNames')
  })

  test('does not mutate the canonical species', () => {
    const clone = JSON.parse(JSON.stringify(SPECIES))
    projectSpeciesToMobile(SPECIES, { requestedLanguageTag: 'en-GB' })
    expect(SPECIES).toEqual(clone)
  })

  test('is deterministic', () => {
    const context = { countryCode: 'GBR' }
    expect(projectSpeciesToMobile(SPECIES, context)).toEqual(
      projectSpeciesToMobile(SPECIES, context)
    )
  })
})
