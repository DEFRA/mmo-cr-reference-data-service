import { findDuplicates } from '../duplicate-detection.js'
import { isValidDateOrder } from '../date-range-validation.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

// Casing per owner decision (2026-09-16): case-insensitive except MMSI.
const IDENTIFIER_FIELDS = Object.freeze([
  { field: 'cfr', caseInsensitive: true },
  { field: 'uvi', caseInsensitive: true },
  { field: 'mmsi', caseInsensitive: false },
  { field: 'ircs', caseInsensitive: true },
  { field: 'externalMark', caseInsensitive: true },
  { field: 'registrationNumber', caseInsensitive: true }
])

function hasValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function validateNaturalIdentifierPresence(items) {
  const errors = []

  items.forEach((item, itemIndex) => {
    const identifiers = item?.identifiers ?? {}
    const hasIdentifier = IDENTIFIER_FIELDS.some(({ field }) =>
      hasValue(identifiers[field])
    )

    if (!hasIdentifier) {
      errors.push({
        code: VALIDATION_ISSUE_CODE.MISSING_NATURAL_IDENTIFIER,
        message: `items[${itemIndex}] has no supported natural identifier.`,
        path: `items[${itemIndex}].identifiers`,
        itemIndex
      })
    }
  })

  return errors
}

function validateIdentifierUniqueness(items) {
  const errors = []

  for (const { field, caseInsensitive } of IDENTIFIER_FIELDS) {
    const entries = items.map((item, itemIndex) => ({
      value: item?.identifiers?.[field],
      path: `items[${itemIndex}].identifiers.${field}`,
      itemIndex
    }))

    for (const duplicate of findDuplicates(entries, { caseInsensitive })) {
      errors.push({
        code: VALIDATION_ISSUE_CODE.DUPLICATE_BUSINESS_CODE,
        message: `Duplicate ${field} "${duplicate.value}" found in items.`,
        path: duplicate.entries[0].path,
        itemIndex: duplicate.entries[0].itemIndex,
        rejectedValue: duplicate.value,
        context: {
          field,
          itemIndexes: duplicate.entries.map((entry) => entry.itemIndex)
        }
      })
    }
  }

  return errors
}

function validateActiveDateRange(items) {
  const errors = []

  items.forEach((item, itemIndex) => {
    if (
      !isValidDateOrder({
        startValue: item?.activeFrom,
        endValue: item?.activeTo
      })
    ) {
      errors.push({
        code: VALIDATION_ISSUE_CODE.INVALID_DATE_RANGE,
        message: `items[${itemIndex}].activeTo precedes activeFrom.`,
        path: `items[${itemIndex}].activeTo`,
        itemIndex
      })
    }
  })

  return errors
}

/**
 * Vessel-specific business rules (Step 09). `lengthOverallMetres` non-negativity is
 * deliberately not re-checked here: the Step 04 schema already requires a strictly
 * positive number, so a separate runtime check would be unreachable and redundant.
 */
export function validateVesselsCollection(collection) {
  const items = Array.isArray(collection?.items) ? collection.items : []

  const errors = [
    ...validateNaturalIdentifierPresence(items),
    ...validateIdentifierUniqueness(items),
    ...validateActiveDateRange(items)
  ]

  return { valid: errors.length === 0, errors, warnings: [] }
}
