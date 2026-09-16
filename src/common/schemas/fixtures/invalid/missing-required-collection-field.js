import { validPortsCollection } from '#/common/schemas/fixtures/valid/ports.js'

const { collectionId, ...withoutCollectionId } = validPortsCollection

export const dataset = 'ports'
export const invalidPayload = withoutCollectionId
