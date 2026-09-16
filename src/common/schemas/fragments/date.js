import Joi from 'joi'

// ISO 8601 full-date only (e.g. "2015-03-17"); no time component permitted.
export const dateOnlySchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
