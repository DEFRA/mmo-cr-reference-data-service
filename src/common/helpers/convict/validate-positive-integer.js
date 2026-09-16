import Joi from 'joi'

export const convictValidatePositiveInteger = {
  name: 'positive-integer',
  validate: function validatePositiveInteger(value) {
    Joi.assert(value, Joi.number().integer().greater(0).required())
  }
}
