import { describe, expect, test } from 'vitest'

import {
  speciesCommonNameSchema,
  speciesItemSchema,
  speciesLocalNameSchema,
  speciesCollectionSchema
} from './species.js'

const validCommonName = {
  id: '11111111-1111-4111-8111-111111111111',
  countryCode: 'GBR',
  name: 'Cod'
}

const validLocalName = {
  id: '22222222-2222-4222-8222-222222222222',
  languageCode: 'cy',
  name: 'Penfras',
  official: false
}

const validSpecies = {
  id: 'da465aa5-abcf-443a-bc7e-62e78978bca7',
  faoCode: 'COD',
  scientificName: 'Gadus morhua',
  commonNames: [validCommonName],
  localNames: [validLocalName],
  active: true
}

describe('#speciesCommonNameSchema / #speciesLocalNameSchema', () => {
  test('accepts a valid common name', () => {
    expect(
      speciesCommonNameSchema.validate(validCommonName).error
    ).toBeUndefined()
  })

  test('rejects an invalid common-name structure', () => {
    const { error } = speciesCommonNameSchema.validate({
      ...validCommonName,
      countryCode: 123
    })

    expect(error).toBeDefined()
  })

  test('accepts a valid local name', () => {
    expect(
      speciesLocalNameSchema.validate(validLocalName).error
    ).toBeUndefined()
  })

  test('rejects an invalid local-name structure', () => {
    const { error } = speciesLocalNameSchema.validate({
      ...validLocalName,
      official: 'no'
    })

    expect(error).toBeDefined()
  })
})

describe('#speciesItemSchema', () => {
  test('accepts a valid species item', () => {
    expect(speciesItemSchema.validate(validSpecies).error).toBeUndefined()
  })
})

describe('#speciesCollectionSchema', () => {
  test('accepts a valid species collection', () => {
    const collection = {
      dataset: 'species',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      items: [validSpecies]
    }

    expect(speciesCollectionSchema.validate(collection).error).toBeUndefined()
  })
})
