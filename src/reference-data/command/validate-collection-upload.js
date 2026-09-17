// Command Module use case: validates a complete uploaded reference-data collection
// WITHOUT persisting, activating, or otherwise changing any active state (Step 21).
// Reuses the same structural -> normalise -> business stage order already established
// by the Cache Refresh Module (Step 11, `cache-refresh/dataset-processing.js`) rather
// than the fused `validateCollection()` (Step 08), which validates business rules
// before normalisation runs. Never accesses S3, Floci, the Authentication Service, the
// In-Memory Data Store, or the Cache Refresh Module.

import { getCollectionSchema } from '#/common/schemas/schema-registry.js'
import { validateAgainstSchema } from '#/common/schemas/validate.js'
import { isSupportedSchemaVersion } from '#/common/schemas/schema-versions.js'
import {
  isSupportedDataset,
  isUploadableDataset
} from '#/common/domain/datasets.js'
import { normaliseCollection } from '#/reference-data/normalisation/index.js'
import { resolveDatasetBusinessValidator } from '#/reference-data/validation/index.js'
import { validateCommonEnvelope } from '#/reference-data/validation/collection-envelope-validator.js'
import { mapStructuralIssues } from '#/reference-data/validation/validate-collection.js'
import { VALIDATION_ISSUE_CODE } from '#/reference-data/validation/error-codes.js'
import { createIssueCollector } from '#/reference-data/validation/validation-result.js'
import { PROCESSING_STAGE } from '#/reference-data/cache-refresh/dataset-processing.js'

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

function findGuardIssue(dataset, schemaVersion) {
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

function addErrors(collector, issues, dataset, correlationId) {
  for (const issue of issues) {
    collector.addError({ ...issue, dataset, correlationId })
  }
}

function addWarnings(collector, issues, dataset, correlationId) {
  for (const issue of issues) {
    collector.addWarning({ ...issue, dataset, correlationId })
  }
}

// Every pre-normalisation failure path shares the same shape: the same stage, and
// `changed` is meaningless before normalisation ever runs.
function structuralFailureResult(collector, receivedCount) {
  return {
    ...collector.toResult({ receivedCount }),
    stage: PROCESSING_STAGE.STRUCTURAL_VALIDATION,
    changed: false
  }
}

function runStructuralStage({
  dataset,
  schemaVersion,
  collection,
  collector,
  correlationId
}) {
  const guardIssue = findGuardIssue(dataset, schemaVersion)
  if (guardIssue) {
    addErrors(collector, [guardIssue], dataset, correlationId)
    return { ok: false }
  }

  const schema = getCollectionSchema(dataset, schemaVersion)
  const { error: structuralError } = validateAgainstSchema(schema, collection)
  if (structuralError) {
    addErrors(
      collector,
      mapStructuralIssues(structuralError),
      dataset,
      correlationId
    )
    return { ok: false }
  }

  return { ok: isUsableStructure(collection) }
}

function runNormaliseAndBusinessStage({
  dataset,
  collection,
  collector,
  correlationId
}) {
  const {
    value: normalised,
    changed,
    warnings: normalisationWarnings
  } = normaliseCollection({ dataset, collection })

  addWarnings(collector, normalisationWarnings, dataset, correlationId)
  addErrors(
    collector,
    validateCommonEnvelope({ dataset, collection: normalised }),
    dataset,
    correlationId
  )

  const businessResult = resolveDatasetBusinessValidator(dataset)(normalised, {
    correlationId
  })
  addErrors(collector, businessResult?.errors ?? [], dataset, correlationId)
  addWarnings(collector, businessResult?.warnings ?? [], dataset, correlationId)

  return { normalised, changed }
}

/**
 * @param {{ dataset: string, schemaVersion: string, collection: *, correlationId?: string }} params
 * @param {boolean} [includeNormalisedCollection] when true and the collection is valid,
 *   includes the normalised collection value on the result (Step 22 needs it to persist
 *   and publish; Step 21's own validation-only response never sets this, so it never
 *   exposes the complete normalised collection).
 * @returns {{ valid: boolean, stage: string|null, errors: Array, warnings: Array, receivedCount?: number, normalisedCount?: number, changed: boolean, collection?: * }}
 */
export function validateCollectionUpload({
  dataset,
  schemaVersion,
  collection,
  correlationId,
  includeNormalisedCollection = false
} = {}) {
  const collector = createIssueCollector()
  const receivedCount = countRecords(collection)

  const structuralStage = runStructuralStage({
    dataset,
    schemaVersion,
    collection,
    collector,
    correlationId
  })
  if (!structuralStage.ok) {
    return structuralFailureResult(collector, receivedCount)
  }

  const { normalised, changed } = runNormaliseAndBusinessStage({
    dataset,
    collection,
    collector,
    correlationId
  })

  const result = collector.toResult({
    receivedCount,
    normalisedCount: countRecords(normalised)
  })

  return {
    ...result,
    stage: result.valid ? null : PROCESSING_STAGE.BUSINESS_VALIDATION,
    changed,
    ...(result.valid && includeNormalisedCollection
      ? { collection: normalised }
      : {})
  }
}
