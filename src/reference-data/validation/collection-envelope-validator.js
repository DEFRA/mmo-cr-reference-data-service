import {
  DATASET_FORMAT,
  getDatasetCapabilities
} from '#/common/domain/datasets.js'
import { findDuplicates } from './duplicate-detection.js'
import { validateFeatureCollectionGeometries } from './geojson-validation.js'
import { VALIDATION_ISSUE_CODE } from './error-codes.js'

function validateDatasetMatch(dataset, collection) {
  if (collection.dataset !== undefined && collection.dataset !== dataset) {
    return [
      {
        code: VALIDATION_ISSUE_CODE.DATASET_MISMATCH,
        message: `Expected dataset "${dataset}" but the collection declares "${collection.dataset}".`,
        path: 'dataset',
        rejectedValue: collection.dataset
      }
    ]
  }
  return []
}

function validateItemCount(collection, records, recordsPath) {
  if (!Array.isArray(records) || typeof collection.itemCount !== 'number') {
    return []
  }
  if (collection.itemCount === records.length) {
    return []
  }
  return [
    {
      code: VALIDATION_ISSUE_CODE.INVALID_ITEM_COUNT,
      message: `itemCount (${collection.itemCount}) does not match the number of ${recordsPath} (${records.length}).`,
      path: 'itemCount',
      rejectedValue: collection.itemCount
    }
  ]
}

function validateGuidUniqueness(records, recordsPath) {
  if (!Array.isArray(records)) {
    return []
  }

  const entries = records.map((record, itemIndex) => ({
    value: record?.id,
    path: `${recordsPath}[${itemIndex}].id`,
    itemIndex
  }))

  return findDuplicates(entries).map((duplicate) => ({
    code: VALIDATION_ISSUE_CODE.DUPLICATE_GUID,
    message: `Duplicate GUID "${duplicate.value}" found in ${recordsPath}.`,
    path: duplicate.entries[0].path,
    itemIndex: duplicate.entries[0].itemIndex,
    rejectedValue: duplicate.value,
    context: { itemIndexes: duplicate.entries.map((entry) => entry.itemIndex) }
  }))
}

/**
 * Common, dataset-agnostic business validation applied to every uploadable collection
 * envelope before dataset-specific rules run. Never mutates `collection`.
 */
export function validateCommonEnvelope({ dataset, collection }) {
  if (
    collection === null ||
    typeof collection !== 'object' ||
    Array.isArray(collection)
  ) {
    return []
  }

  const capabilities = getDatasetCapabilities(dataset)
  const isGeoJson = capabilities.format === DATASET_FORMAT.GEOJSON
  const recordsPath = isGeoJson ? 'features' : 'items'
  const records = isGeoJson ? collection.features : collection.items

  const issues = [
    ...validateDatasetMatch(dataset, collection),
    ...validateItemCount(collection, records, recordsPath),
    ...validateGuidUniqueness(records, recordsPath)
  ]

  if (isGeoJson) {
    issues.push(...validateFeatureCollectionGeometries(collection))
  }

  return issues
}
