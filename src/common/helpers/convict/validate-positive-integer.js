import Joi from 'joi'

export const convictValidatePositiveInteger = {
  name: 'positive-integer',
  coerce: function coercePositiveInteger(value) {
    return typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : value
  },
  validate: function validatePositiveInteger(value) {
    Joi.assert(value, Joi.number().integer().greater(0).required())
  }
}
