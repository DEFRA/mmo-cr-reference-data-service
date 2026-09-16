import { validPortsCollection } from '#/common/schemas/fixtures/valid/ports.js'

export const dataset = 'ports'
export const invalidPayload = {
  ...validPortsCollection,
  items: [
    {
      ...validPortsCollection.items[0],
      coordinate: { latitude: 50.3661 }
    }
  ]
}
