import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { coordinateSchema } from '#/common/schemas/fragments/coordinate.js'
import { createFeatureSchema } from '#/common/schemas/fragments/geojson.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

// Feature `id` and `properties.id` are both required independently; enforcing their
// equality is a business-validation rule deferred to a later step.
export const statisticalAreaPropertiesSchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  areaType: Joi.string().min(1).required(),
  parentCode: Joi.string().min(1).allow(null).optional(),
  parentName: Joi.string().min(1).allow(null).optional(),
  areaKm2: Joi.number().strict().positive().allow(null).optional(),
  centroid: coordinateSchema.allow(null).optional()
})

export const mapStatisticalAreaFeatureSchema = createFeatureSchema(
  statisticalAreaPropertiesSchema
)

export const mapStatisticalAreasCollectionSchema =
  createCollectionEnvelopeSchema(DATASETS.MAP_STATISTICAL_AREAS, {
    type: Joi.string().valid('FeatureCollection').required(),
    features: Joi.array().items(mapStatisticalAreaFeatureSchema).required()
  })
