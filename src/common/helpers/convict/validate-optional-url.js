import Joi from 'joi'

export const convictValidateOptionalUrl = {
  name: 'optional-url',
  validate: function validateOptionalUrl(value) {
    if (value === null || value === undefined) {
      return
    }

    Joi.assert(value, Joi.string().uri({ scheme: ['http', 'https'] }))
  }
}
