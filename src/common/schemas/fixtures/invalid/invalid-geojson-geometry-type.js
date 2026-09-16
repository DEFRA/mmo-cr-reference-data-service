import { validMapLandCollection } from '#/common/schemas/fixtures/valid/map-land.js'

export const dataset = 'map-land'
export const invalidPayload = {
  ...validMapLandCollection,
  features: [
    {
      ...validMapLandCollection.features[0],
      geometry: { type: 'Point', coordinates: [0, 0] }
    }
  ]
}
