import Joi from 'joi'

// RFC 3339 / ISO 8601 date-time only; requires a time component and UTC/offset designator.
export const timestampSchema = Joi.string().pattern(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
)
