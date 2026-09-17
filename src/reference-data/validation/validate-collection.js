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

// Exported for reuse by the Command Module's validation-only upload pipeline (Step 21),
// which needs the same Joi-detail-to-issue-code mapping but assembles its own
// structural -> normalise -> business stage order.
export function mapStructuralIssues(joiError) {
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

function addIssues(addFn, issues, dataset, correlationId) {
  for (const issue of issues) {
    addFn({ ...issue, dataset, correlationId })
  }
}

// Returns a single blocking issue when the dataset or schema version cannot be
// resolved at all, or null when it is safe to proceed to structural validation.
function findRequestGuardIssue({ dataset, schemaVersion }) {
  if (!isSupportedDataset(dataset) || !isUploadableDataset(dataset)) {
    return {
      code: VALIDATION_ISSUE_CODE.UNSUPPORTED_DATASET,
      message: `"${dataset}" is not a supported, uploadable dataset.`
    }
  }
  if (!isSupportedSchemaVersion(schemaVersion)) {
    return {
      code: VALIDATION_ISSUE_CODE.UNSUPPORTED_SCHEMA_VERSION,
      message: `Schema version "${schemaVersion}" is not supported.`
    }
  }
  return null
}

function runStructuralValidation({
  dataset,
  schemaVersion,
  collection,
  collector,
  correlationId
}) {
  const schema = getCollectionSchema(dataset, schemaVersion)
  const { error } = validateAgainstSchema(schema, collection)

  if (error) {
    addIssues(
      collector.addError,
      mapStructuralIssues(error),
      dataset,
      correlationId
    )
  }
}

function runBusinessValidation({
  dataset,
  collection,
  collector,
  correlationId
}) {
  addIssues(
    collector.addError,
    validateCommonEnvelope({ dataset, collection }),
    dataset,
    correlationId
  )

  const businessResult = resolveDatasetBusinessValidator(dataset)(collection, {
    correlationId
  })

  addIssues(
    collector.addError,
    businessResult?.errors ?? [],
    dataset,
    correlationId
  )
  addIssues(
    collector.addWarning,
    businessResult?.warnings ?? [],
    dataset,
    correlationId
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

  const guardIssue = findRequestGuardIssue({ dataset, schemaVersion })
  if (guardIssue) {
    collector.addError({ ...guardIssue, dataset, correlationId })
    return collector.toResult({ receivedCount })
  }

  runStructuralValidation({
    dataset,
    schemaVersion,
    collection,
    collector,
    correlationId
  })

  if (!isUsableStructure(collection)) {
    return collector.toResult({ receivedCount })
  }

  runBusinessValidation({ dataset, collection, collector, correlationId })

  return collector.toResult({
    receivedCount,
    normalisedCount: countRecords(collection)
  })
}
