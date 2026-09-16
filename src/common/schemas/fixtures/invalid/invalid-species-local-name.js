import { validSpeciesCollection } from '#/common/schemas/fixtures/valid/species.js'

export const dataset = 'species'
export const invalidPayload = {
  ...validSpeciesCollection,
  items: [
    {
      ...validSpeciesCollection.items[0],
      localNames: [
        { ...validSpeciesCollection.items[0].localNames[0], official: 'no' }
      ]
    }
  ]
}
