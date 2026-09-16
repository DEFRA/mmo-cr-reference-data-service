import Joi from 'joi'

export const convictValidateNonNegativeInteger = {
  name: 'non-negative-integer',
  coerce: function coerceNonNegativeInteger(value) {
    return typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : value
  },
  validate: function validateNonNegativeInteger(value) {
    Joi.assert(value, Joi.number().integer().min(0).required())
  }
}
