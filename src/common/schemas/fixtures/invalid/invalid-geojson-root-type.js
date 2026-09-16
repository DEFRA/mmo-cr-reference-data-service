import { validMapLandCollection } from '#/common/schemas/fixtures/valid/map-land.js'

export const dataset = 'map-land'
export const invalidPayload = {
  ...validMapLandCollection,
  type: 'Feature'
}
