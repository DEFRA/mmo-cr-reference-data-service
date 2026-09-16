import { validPortsCollection } from '#/common/schemas/fixtures/valid/ports.js'

export const dataset = 'ports'
export const invalidPayload = {
  ...validPortsCollection,
  items: [
    {
      ...validPortsCollection.items[0],
      coordinate: { latitude: 91, longitude: -4.1427 }
    }
  ]
}
