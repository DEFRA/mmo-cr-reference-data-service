import Joi from 'joi'

// Central definition of supported canonical schema versions; do not scatter '1.0' elsewhere.
export const SCHEMA_VERSIONS = Object.freeze({
  V1: '1.0'
})

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.V1

export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(
  Object.values(SCHEMA_VERSIONS)
)

export function isSupportedSchemaVersion(value) {
  return SUPPORTED_SCHEMA_VERSIONS.includes(value)
}

export const schemaVersionSchema = Joi.string().valid(
  ...SUPPORTED_SCHEMA_VERSIONS
)
