import { validMapStatisticalAreasCollection } from '#/common/schemas/fixtures/valid/map-statistical-areas.js'

const { code, ...propertiesWithoutCode } =
  validMapStatisticalAreasCollection.features[0].properties

export const dataset = 'map-statistical-areas'
export const invalidPayload = {
  ...validMapStatisticalAreasCollection,
  features: [
    {
      ...validMapStatisticalAreasCollection.features[0],
      properties: propertiesWithoutCode
    }
  ]
}
