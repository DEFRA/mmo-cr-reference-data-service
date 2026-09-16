const VALIDATE_OPTIONS = Object.freeze({
  convert: false,
  abortEarly: false,
  allowUnknown: false
})

// Never coerces types and never mutates the supplied input; returns Joi's own { value, error }.
export function validateAgainstSchema(schema, value) {
  return schema.validate(value, VALIDATE_OPTIONS)
}

// Maps Joi error details to safe, stable issue shapes without leaking rejected payloads or stack traces.
export function mapValidationErrorDetails(error) {
  if (!error) {
    return []
  }

  return error.details.map((detail) => ({
    path: detail.path.join('.'),
    message: detail.message,
    type: detail.type
  }))
}
