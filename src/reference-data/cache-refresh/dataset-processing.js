import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import {
  mapValidationErrorDetails,
  validateAgainstSchema
} from '#/common/schemas/validate.js'
import { normaliseCollection } from '#/reference-data/normalisation/index.js'
import { validateCommonEnvelope } from '#/reference-data/validation/collection-envelope-validator.js'
import { resolveDatasetBusinessValidator } from '#/reference-data/validation/index.js'

export const PROCESSING_STAGE = Object.freeze({
  STRUCTURAL_VALIDATION: 'structural-validation',
  BUSINESS_VALIDATION: 'business-validation'
})

/**
 * Runs the approved structural -> normalisation -> business pipeline against one
 * dataset's persisted content. Never mutates `content`, never accesses S3/Floci/the
 * Authentication Service, and never updates the in-memory store directly.
 */
export function processDatasetCollection({ dataset, schemaVersion, content }) {
  const schema = getCollectionSchema(dataset, schemaVersion)
  const { error } = validateAgainstSchema(schema, content)
  if (error) {
    return {
      ok: false,
      stage: PROCESSING_STAGE.STRUCTURAL_VALIDATION,
      issues: mapValidationErrorDetails(error)
    }
  }

  const { value: normalised, warnings: normalisationWarnings } =
    normaliseCollection({ dataset, collection: content })

  const businessResult = resolveDatasetBusinessValidator(dataset)(
    normalised,
    {}
  )
  const issues = [
    ...validateCommonEnvelope({ dataset, collection: normalised }),
    ...(businessResult?.errors ?? [])
  ]

  if (issues.length > 0) {
    return { ok: false, stage: PROCESSING_STAGE.BUSINESS_VALIDATION, issues }
  }

  return {
    ok: true,
    collection: normalised,
    warnings: [...normalisationWarnings, ...(businessResult?.warnings ?? [])]
  }
}
