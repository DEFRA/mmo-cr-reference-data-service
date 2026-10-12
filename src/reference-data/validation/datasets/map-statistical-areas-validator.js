import { findDuplicates } from '../duplicate-detection.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

/**
 * Map-statistical-area-specific business rules. Per
 * docs/adr/0001-map-statistical-areas-raw-epsg3857-contract.md, this dataset serves
 * the raw upstream ArcGIS export: the business-uniqueness key is `properties.sub_code`
 * (not `ICESNAME`, which legitimately repeats across subrectangles of the same
 * parent ICES rectangle).
 */
export function validateMapStatisticalAreasCollection(collection) {
  const features = Array.isArray(collection?.features)
    ? collection.features
    : []

  // Area codes are compared case-insensitively per owner decision (2026-09-16).
  const entries = features.map((feature, itemIndex) => ({
    value: feature?.properties?.sub_code,
    path: `features[${itemIndex}].properties.sub_code`,
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
