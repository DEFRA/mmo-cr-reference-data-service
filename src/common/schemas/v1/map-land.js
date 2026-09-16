import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { createFeatureSchema } from '#/common/schemas/fragments/geojson.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

// Intentionally minimal for v1; additional approved properties require a schema-version bump.
export const mapLandFeaturePropertiesSchema = Joi.object({
  id: guidSchema.required(),
  name: Joi.string().min(1).optional()
})

export const mapLandFeatureSchema = createFeatureSchema(
  mapLandFeaturePropertiesSchema
)

export const mapLandCollectionSchema = createCollectionEnvelopeSchema(
  DATASETS.MAP_LAND,
  {
    type: Joi.string().valid('FeatureCollection').required(),
    features: Joi.array().items(mapLandFeatureSchema).required()
  }
)
