import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { createFeatureSchema } from '#/common/schemas/fragments/geojson.js'

// Derived from the canonical ports collection: not uploadable, not independently
// persisted, and never an authoritative manifest dataset. Deliberately not
// registered in the schema registry — reusable only for future response validation.
export const mapPortsFeaturePropertiesSchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required()
})

export const mapPortsFeatureSchema = createFeatureSchema(
  mapPortsFeaturePropertiesSchema
)
