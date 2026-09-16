import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import {
  mapValidationErrorDetails,
  validateAgainstSchema
} from '#/common/schemas/validate.js'
import { isSupportedSchemaVersion } from '#/common/schemas/schema-versions.js'
import {
  isSupportedDataset,
  isUploadableDataset
} from '#/common/domain/datasets.js'
import { createIssueCollector } from './validation-result.js'
import { VALIDATION_ISSUE_CODE } from './error-codes.js'
import { validateCommonEnvelope } from './collection-envelope-validator.js'
import { resolveDatasetBusinessValidator } from './dataset-validator-registry.js'

// Maps a subset of Joi detail types to a more specific issue code than the generic
// invalid_property_type fallback; not every Joi type has a more specific equivalent.
const JOI_TYPE_TO_ISSUE_CODE = Object.freeze({
  'any.required': VALIDATION_ISSUE_CODE.REQUIRED_PROPERTY_MISSING,
  'object.unknown': VALIDATION_ISSUE_CODE.UNEXPECTED_PROPERTY,
  'any.only': VALIDATION_ISSUE_CODE.INVALID_ENUM_VALUE,
  'string.guid': VALIDATION_ISSUE_CODE.INVALID_GUID,
  'object.base': VALIDATION_ISSUE_CODE.INVALID_ROOT_TYPE
})

function mapStructuralIssues(joiError) {
  return mapValidationErrorDetails(joiError).map((detail) => ({
    code:
      JOI_TYPE_TO_ISSUE_CODE[detail.type] ??
      VALIDATION_ISSUE_CODE.INVALID_PROPERTY_TYPE,
    message: detail.message,
    path: detail.path
  }))
}

function countRecords(collection) {
  if (Array.isArray(collection?.items)) {
    return collection.items.length
  }
  if (Array.isArray(collection?.features)) {
    return collection.features.length
  }
  return undefined
}

function isUsableStructure(collection) {
  return (
    collection !== null &&
    typeof collection === 'object' &&
    !Array.isArray(collection)
  )
}

/**
 * Full common validation pipeline for one uploaded collection:
 * structural (Step 04 schema) -> common business (this step) -> dataset-specific
 * business (Step 09, via the registry). Never mutates `collection`, never accesses
 * S3/Floci/the Authentication Service, and never depends on a Hapi.js request object.
 */
export function validateCollection({
  dataset,
  schemaVersion,
  collection,
  correlationId
} = {}) {
  const collector = createIssueCollector()
  const receivedCount = countRecords(collection)

  if (!isSupportedDataset(dataset) || !isUploadableDataset(dataset)) {
    collector.addError({
      code: VALIDATION_ISSUE_CODE.UNSUPPORTED_DATASET,
      message: `"${dataset}" is not a supported, uploadable dataset.`,
      dataset,
      correlationId
    })
    return collector.toResult({ receivedCount })
  }

  if (!isSupportedSchemaVersion(schemaVersion)) {
    collector.addError({
      code: VALIDATION_ISSUE_CODE.UNSUPPORTED_SCHEMA_VERSION,
      message: `Schema version "${schemaVersion}" is not supported.`,
      dataset,
      correlationId
    })
    return collector.toResult({ receivedCount })
  }

  const schema = getCollectionSchema(dataset, schemaVersion)
  const { error } = validateAgainstSchema(schema, collection)

  if (error) {
    for (const issue of mapStructuralIssues(error)) {
      collector.addError({ ...issue, dataset, correlationId })
    }
  }

  if (!isUsableStructure(collection)) {
    return collector.toResult({ receivedCount })
  }

  for (const issue of validateCommonEnvelope({ dataset, collection })) {
    collector.addError({ ...issue, dataset, correlationId })
  }

  const businessResult = resolveDatasetBusinessValidator(dataset)(collection, {
    correlationId
  })

  for (const issue of businessResult?.errors ?? []) {
    collector.addError({ ...issue, dataset, correlationId })
  }
  for (const issue of businessResult?.warnings ?? []) {
    collector.addWarning({ ...issue, dataset, correlationId })
  }

  return collector.toResult({
    receivedCount,
    normalisedCount: countRecords(collection)
  })
}
