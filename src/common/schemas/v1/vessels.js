import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { dateOnlySchema } from '#/common/schemas/fragments/date.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

const nullableString = Joi.string().allow(null)

// Business identifiers stay separate from the GUID `id`; no homePort per Step 04 scope.
export const vesselIdentifiersSchema = Joi.object({
  cfr: nullableString.optional(),
  uvi: nullableString.optional(),
  mmsi: nullableString.optional(),
  ircs: nullableString.optional(),
  externalMark: nullableString.optional(),
  registrationNumber: nullableString.optional()
})

export const vesselItemSchema = Joi.object({
  id: guidSchema.required(),
  name: Joi.string().min(1).required(),
  namePln: nullableString.optional(),
  identifiers: vesselIdentifiersSchema.required(),
  typeCode: Joi.string().min(1).required(),
  registrationCountryCode: Joi.string().min(1).required(),
  lengthOverallMetres: Joi.number().strict().positive().required(),
  status: Joi.string().min(1).required(),
  activeFrom: dateOnlySchema.required(),
  activeTo: dateOnlySchema.allow(null).optional()
})

export const vesselsCollectionSchema = createCollectionEnvelopeSchema(
  DATASETS.VESSELS,
  { items: Joi.array().items(vesselItemSchema).required() }
)
