import Joi from 'joi'

export const convictValidateNonEmptyString = {
  name: 'non-empty-string',
  validate: function validateNonEmptyString(value) {
    Joi.assert(value, Joi.string().trim().min(1).required())
  }
}
