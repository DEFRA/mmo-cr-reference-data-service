import { findDuplicates } from '../duplicate-detection.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

/**
 * Map-statistical-area-specific business rules (Step 09). `parentCode` resolution
 * within the same collection is deliberately not enforced (owner decision,
 * 2026-09-16): it remains structural-only (non-empty string or null).
 */
export function validateMapStatisticalAreasCollection(collection) {
  const features = Array.isArray(collection?.features)
    ? collection.features
    : []

  // Area codes are compared case-insensitively per owner decision (2026-09-16).
  const entries = features.map((feature, itemIndex) => ({
    value: feature?.properties?.code,
    path: `features[${itemIndex}].properties.code`,
    itemIndex
  }))

  const errors = findDuplicates(entries, { caseInsensitive: true }).map(
    (duplicate) => ({
      code: VALIDATION_ISSUE_CODE.DUPLICATE_BUSINESS_CODE,
      message: `Duplicate statistical-area code "${duplicate.value}" found in features.`,
      path: duplicate.entries[0].path,
      itemIndex: duplicate.entries[0].itemIndex,
      rejectedValue: duplicate.value,
      context: {
        itemIndexes: duplicate.entries.map((entry) => entry.itemIndex)
      }
    })
  )

  return { valid: errors.length === 0, errors, warnings: [] }
}
