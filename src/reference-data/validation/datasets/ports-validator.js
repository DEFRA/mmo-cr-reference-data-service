import { findDuplicates } from '../duplicate-detection.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

/**
 * Port-specific business rules (Step 09). Country-code format and coordinate
 * pairing/range are deliberately not re-checked here: the Step 04 schema already
 * enforces both (paired lat/long, WGS84 range, non-empty countryCode).
 */
export function validatePortsCollection(collection) {
  const items = Array.isArray(collection?.items) ? collection.items : []

  // Port codes are compared exactly (case-sensitive) per owner decision (2026-09-16).
  const entries = items.map((item, itemIndex) => ({
    value: item?.code,
    path: `items[${itemIndex}].code`,
    itemIndex
  }))

  const errors = findDuplicates(entries).map((duplicate) => ({
    code: VALIDATION_ISSUE_CODE.DUPLICATE_BUSINESS_CODE,
    message: `Duplicate port code "${duplicate.value}" found in items.`,
    path: duplicate.entries[0].path,
    itemIndex: duplicate.entries[0].itemIndex,
    rejectedValue: duplicate.value,
    context: { itemIndexes: duplicate.entries.map((entry) => entry.itemIndex) }
  }))

  return { valid: errors.length === 0, errors, warnings: [] }
}
