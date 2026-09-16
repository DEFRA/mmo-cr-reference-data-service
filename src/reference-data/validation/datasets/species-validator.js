import { findDuplicates } from '../duplicate-detection.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

function validateFaoCodeUniqueness(items) {
  const entries = items.map((item, itemIndex) => ({
    value: item?.faoCode,
    path: `items[${itemIndex}].faoCode`,
    itemIndex
  }))

  return findDuplicates(entries, { caseInsensitive: true }).map(
    (duplicate) => ({
      code: VALIDATION_ISSUE_CODE.DUPLICATE_BUSINESS_CODE,
      message: `Duplicate FAO code "${duplicate.value}" found in items.`,
      path: duplicate.entries[0].path,
      itemIndex: duplicate.entries[0].itemIndex,
      rejectedValue: duplicate.value,
      context: {
        itemIndexes: duplicate.entries.map((entry) => entry.itemIndex)
      }
    })
  )
}

// Owner decision (2026-09-16): commonNames[].id and localNames[].id share ONE GUID
// namespace, collection-wide, across both name types combined.
function validateNestedNameGuidUniqueness(items) {
  const entries = []

  items.forEach((item, itemIndex) => {
    ;(item?.commonNames ?? []).forEach((commonName, nameIndex) => {
      entries.push({
        value: commonName?.id,
        path: `items[${itemIndex}].commonNames[${nameIndex}].id`,
        itemIndex
      })
    })
    ;(item?.localNames ?? []).forEach((localName, nameIndex) => {
      entries.push({
        value: localName?.id,
        path: `items[${itemIndex}].localNames[${nameIndex}].id`,
        itemIndex
      })
    })
  })

  return findDuplicates(entries).map((duplicate) => ({
    code: VALIDATION_ISSUE_CODE.DUPLICATE_GUID,
    message: `Duplicate nested name GUID "${duplicate.value}" found across commonNames/localNames.`,
    path: duplicate.entries[0].path,
    itemIndex: duplicate.entries[0].itemIndex,
    rejectedValue: duplicate.value,
    context: {
      paths: duplicate.entries.map((entry) => entry.path)
    }
  }))
}

function validateOfficialLocalNameUniqueness(items) {
  const errors = []

  items.forEach((item, itemIndex) => {
    const localNames = Array.isArray(item?.localNames) ? item.localNames : []
    const officialByLanguage = new Map()

    localNames.forEach((localName, nameIndex) => {
      if (localName?.official !== true) {
        return
      }

      const languageCode = localName?.languageCode
      if (!officialByLanguage.has(languageCode)) {
        officialByLanguage.set(languageCode, [])
      }
      officialByLanguage.get(languageCode).push(nameIndex)
    })

    for (const [languageCode, nameIndexes] of officialByLanguage) {
      if (nameIndexes.length > 1) {
        errors.push({
          code: VALIDATION_ISSUE_CODE.DUPLICATE_OFFICIAL_NAME,
          message: `items[${itemIndex}] has more than one official local name for languageCode "${languageCode}".`,
          path: `items[${itemIndex}].localNames[${nameIndexes[0]}].official`,
          itemIndex,
          context: { languageCode, nameIndexes }
        })
      }
    }
  })

  return errors
}

/**
 * Species-specific business rules (Step 09). Country-code and language-code formats
 * are deliberately not re-checked here: Step 04 left them as unconstrained non-empty
 * strings with no authoritative format to validate against.
 */
export function validateSpeciesCollection(collection) {
  const items = Array.isArray(collection?.items) ? collection.items : []

  const errors = [
    ...validateFaoCodeUniqueness(items),
    ...validateNestedNameGuidUniqueness(items),
    ...validateOfficialLocalNameUniqueness(items)
  ]

  return { valid: errors.length === 0, errors, warnings: [] }
}
