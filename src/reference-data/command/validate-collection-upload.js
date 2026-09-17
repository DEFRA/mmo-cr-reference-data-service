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

  const guardIssue = findGuardIssue(dataset, schemaVersion)
  if (guardIssue) {
    collector.addError({ ...guardIssue, dataset, correlationId })
    return {
      ...collector.toResult({ receivedCount }),
      stage: PROCESSING_STAGE.STRUCTURAL_VALIDATION,
      changed: false
    }
  }

  const schema = getCollectionSchema(dataset, schemaVersion)
  const { error: structuralError } = validateAgainstSchema(schema, collection)
  if (structuralError) {
    for (const issue of mapStructuralIssues(structuralError)) {
      collector.addError({ ...issue, dataset, correlationId })
    }
    return {
      ...collector.toResult({ receivedCount }),
      stage: PROCESSING_STAGE.STRUCTURAL_VALIDATION,
      changed: false
    }
  }

  if (!isUsableStructure(collection)) {
    return {
      ...collector.toResult({ receivedCount }),
      stage: PROCESSING_STAGE.STRUCTURAL_VALIDATION,
      changed: false
    }
  }

  const {
    value: normalised,
    changed,
    warnings: normalisationWarnings
  } = normaliseCollection({ dataset, collection })

  for (const warning of normalisationWarnings) {
    collector.addWarning({ ...warning, dataset, correlationId })
  }

  for (const issue of validateCommonEnvelope({
    dataset,
    collection: normalised
  })) {
    collector.addError({ ...issue, dataset, correlationId })
  }

  const businessResult = resolveDatasetBusinessValidator(dataset)(normalised, {
    correlationId
  })
  for (const issue of businessResult?.errors ?? []) {
    collector.addError({ ...issue, dataset, correlationId })
  }
  for (const warning of businessResult?.warnings ?? []) {
    collector.addWarning({ ...warning, dataset, correlationId })
  }

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
