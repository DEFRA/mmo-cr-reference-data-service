import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { coordinateSchema } from '#/common/schemas/fragments/coordinate.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

export const portItemSchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  countryCode: Joi.string().min(1).required(),
  coordinate: coordinateSchema.allow(null).optional(),
  active: Joi.boolean().strict().required()
})

export const portsCollectionSchema = createCollectionEnvelopeSchema(
  DATASETS.PORTS,
  { items: Joi.array().items(portItemSchema).required() }
)
