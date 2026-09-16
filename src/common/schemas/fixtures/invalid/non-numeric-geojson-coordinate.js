import { validMapLandCollection } from '#/common/schemas/fixtures/valid/map-land.js'

export const dataset = 'map-land'
export const invalidPayload = {
  ...validMapLandCollection,
  features: [
    {
      ...validMapLandCollection.features[0],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            ['-4.2', 50.3],
            [-4.2, 50.4],
            [-4.1, 50.4],
            ['-4.2', 50.3]
          ]
        ]
      }
    }
  ]
}
