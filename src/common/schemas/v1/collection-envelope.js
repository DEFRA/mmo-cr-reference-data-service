import Joi from 'joi'

import { collectionMetadataKeys } from '#/common/schemas/fragments/collection-metadata.js'

// Shared envelope: merges common metadata with per-dataset content keys (items, or
// categories/characteristics/items, or type/features) so metadata is never redefined per format.
export function createCollectionEnvelopeSchema(dataset, contentKeys) {
  return Joi.object({
    dataset: Joi.string().valid(dataset).required(),
    ...collectionMetadataKeys,
    ...contentKeys
  })
}
