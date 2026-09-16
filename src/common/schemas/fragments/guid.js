import Joi from 'joi'

// Structural GUID/UUID check only; does not generate or normalise identifiers.
export const guidSchema = Joi.string().guid()
