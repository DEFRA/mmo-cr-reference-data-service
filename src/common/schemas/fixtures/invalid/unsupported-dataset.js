import { validPortsCollection } from '#/common/schemas/fixtures/valid/ports.js'

export const dataset = 'ports'
export const invalidPayload = {
  ...validPortsCollection,
  dataset: 'unknown-dataset'
}
