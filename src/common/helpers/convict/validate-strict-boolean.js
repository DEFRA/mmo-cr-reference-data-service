import Joi from 'joi'

export const convictValidateStrictBoolean = {
  name: 'strict-boolean',
  coerce: function coerceStrictBoolean(value) {
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
    return value
  },
  validate: function validateStrictBoolean(value) {
    Joi.assert(value, Joi.boolean().strict().required())
  }
}
