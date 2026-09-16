import { describe, expect, test } from 'vitest'

import { vesselItemSchema, vesselsCollectionSchema } from './vessels.js'

const validVessel = {
  id: '73168db4-1996-46f8-91cb-2288fe2e689c',
  name: 'ACHILLES',
  namePln: 'ACHILLES PH1234',
  identifiers: {
    cfr: 'GBR000A1234',
    uvi: null,
    mmsi: '232001234',
    ircs: 'MABC7',
    externalMark: 'PH1234',
    registrationNumber: 'PH1234'
  },
  typeCode: 'FISHING',
  registrationCountryCode: 'GBR',
  lengthOverallMetres: 8.74,
  status: 'active',
  activeFrom: '2015-03-17',
  activeTo: null
}

describe('#vesselItemSchema', () => {
  test('accepts a valid vessel', () => {
    expect(vesselItemSchema.validate(validVessel).error).toBeUndefined()
  })

  test('keeps business identifiers separate from id', () => {
    const { error, value } = vesselItemSchema.validate(validVessel)

    expect(error).toBeUndefined()
    expect(value.id).toBe('73168db4-1996-46f8-91cb-2288fe2e689c')
    expect(value.identifiers.cfr).toBe('GBR000A1234')
    expect(value.identifiers).not.toHaveProperty('id')
  })

  test('rejects an invalid item GUID', () => {
    const { error } = vesselItemSchema.validate({
      ...validVessel,
      id: 'not-a-guid'
    })

    expect(error).toBeDefined()
  })

  test('rejects a wrong-typed lengthOverallMetres', () => {
    const { error } = vesselItemSchema.validate({
      ...validVessel,
      lengthOverallMetres: '8.74'
    })

    expect(error).toBeDefined()
  })

  test('does not require homePort and rejects it as an unknown property', () => {
    const { error } = vesselItemSchema.validate({
      ...validVessel,
      homePort: 'Plymouth'
    })

    expect(error).toBeDefined()
  })

  test('rejects a date-time value for activeFrom', () => {
    const { error } = vesselItemSchema.validate({
      ...validVessel,
      activeFrom: '2015-03-17T00:00:00Z'
    })

    expect(error).toBeDefined()
  })
})

describe('#vesselsCollectionSchema', () => {
  test('accepts a valid vessels collection', () => {
    const collection = {
      dataset: 'vessels',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      items: [validVessel]
    }

    expect(vesselsCollectionSchema.validate(collection).error).toBeUndefined()
  })
})
