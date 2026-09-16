import { validSpeciesCollection } from '#/common/schemas/fixtures/valid/species.js'

export const dataset = 'species'
export const invalidPayload = {
  ...validSpeciesCollection,
  items: [
    {
      ...validSpeciesCollection.items[0],
      commonNames: [
        { ...validSpeciesCollection.items[0].commonNames[0], countryCode: 123 }
      ]
    }
  ]
}
