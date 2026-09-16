import Joi from 'joi'

import { guidSchema } from '#/common/schemas/fragments/guid.js'
import { createCollectionEnvelopeSchema } from '#/common/schemas/v1/collection-envelope.js'
import { DATASETS } from '#/common/domain/datasets.js'

const nullableNumber = Joi.number().strict().allow(null)

export const gearCategorySchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required()
})

export const gearCharacteristicSchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  dataType: Joi.string().min(1).required(),
  unit: Joi.string().allow(null).optional(),
  minValue: nullableNumber.optional(),
  maxValue: nullableNumber.optional()
})

// `fixed` and `required` are deliberately separate booleans; `fixed` does not imply
// a mobile required-measurement rule.
export const gearApplicableCharacteristicSchema = Joi.object({
  id: guidSchema.required(),
  characteristicId: guidSchema.required(),
  fixed: Joi.boolean().strict().required(),
  required: Joi.boolean().strict().required(),
  vesselLengthApplicability: Joi.array().items(Joi.string().min(1)).optional()
})

export const gearItemSchema = Joi.object({
  id: guidSchema.required(),
  code: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  type: Joi.string().min(1).required(),
  categoryId: guidSchema.required(),
  pairFishing: Joi.boolean().strict().required(),
  applicableCharacteristics: Joi.array()
    .items(gearApplicableCharacteristicSchema)
    .required(),
  active: Joi.boolean().strict().required()
})

// itemCount reflects the `items` array length only; categories/characteristics are reference lists.
export const gearsCollectionSchema = createCollectionEnvelopeSchema(
  DATASETS.GEARS,
  {
    categories: Joi.array().items(gearCategorySchema).required(),
    characteristics: Joi.array().items(gearCharacteristicSchema).required(),
    items: Joi.array().items(gearItemSchema).required()
  }
)
