import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

export const speciesCommonNameSchema = Joi.object({
  id: guidSchema.required(),
  countryCode: Joi.string().min(1).required(),
  name: Joi.string().min(1).required()
})

export const speciesLocalNameSchema = Joi.object({
  id: guidSchema.required(),
  languageCode: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  official: Joi.boolean().strict().required()
})

export const speciesItemSchema = Joi.object({
  id: guidSchema.required(),
  faoCode: Joi.string().min(1).required(),
  scientificName: Joi.string().min(1).required(),
  commonNames: Joi.array().items(speciesCommonNameSchema).required(),
  localNames: Joi.array().items(speciesLocalNameSchema).required(),
  active: Joi.boolean().strict().required()
})

export const speciesCollectionSchema = createCollectionEnvelopeSchema(
  DATASETS.SPECIES,
  { items: Joi.array().items(speciesItemSchema).required() }
)
