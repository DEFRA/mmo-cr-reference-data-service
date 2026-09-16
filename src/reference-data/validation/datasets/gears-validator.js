import { findDuplicates } from '../duplicate-detection.js'
import {
  createReferenceIndex,
  referenceExists
} from '../relationship-validation.js'
import {
  isSupportedCharacteristicDataType,
  GEAR_CHARACTERISTIC_DATA_TYPES
} from '../gear-characteristic-data-types.js'
import { isSupportedVesselLengthBand } from '../vessel-length-bands.js'
import { VALIDATION_ISSUE_CODE } from '../error-codes.js'

// Casing per owner decision (2026-09-16): gear/category/characteristic codes are
// case-insensitive; each code type has its own uniqueness namespace.
function validateCodeUniqueness(records, recordsPath) {
  const entries = records.map((record, itemIndex) => ({
    value: record?.code,
    path: `${recordsPath}[${itemIndex}].code`,
    itemIndex
  }))

  return findDuplicates(entries, { caseInsensitive: true }).map(
    (duplicate) => ({
      code: VALIDATION_ISSUE_CODE.DUPLICATE_BUSINESS_CODE,
      message: `Duplicate code "${duplicate.value}" found in ${recordsPath}.`,
      path: duplicate.entries[0].path,
      itemIndex: duplicate.entries[0].itemIndex,
      rejectedValue: duplicate.value,
      context: {
        recordsPath,
        itemIndexes: duplicate.entries.map((entry) => entry.itemIndex)
      }
    })
  )
}

function validateCategoryReferences(items, categories) {
  const index = createReferenceIndex(categories, (category) => category?.id)

  return items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => !referenceExists(index, item?.categoryId))
    .map(({ item, itemIndex }) => ({
      code: VALIDATION_ISSUE_CODE.UNRESOLVED_REFERENCE,
      message: `items[${itemIndex}].categoryId does not resolve to a category in this collection.`,
      path: `items[${itemIndex}].categoryId`,
      itemIndex,
      rejectedValue: item?.categoryId
    }))
}

function validateCharacteristicReferences(items, characteristics) {
  const index = createReferenceIndex(
    characteristics,
    (characteristic) => characteristic?.id
  )
  const errors = []

  items.forEach((item, itemIndex) => {
    const applicable = Array.isArray(item?.applicableCharacteristics)
      ? item.applicableCharacteristics
      : []

    applicable.forEach((relationship, relationshipIndex) => {
      if (!referenceExists(index, relationship?.characteristicId)) {
        errors.push({
          code: VALIDATION_ISSUE_CODE.UNRESOLVED_REFERENCE,
          message: `items[${itemIndex}].applicableCharacteristics[${relationshipIndex}].characteristicId does not resolve to a characteristic in this collection.`,
          path: `items[${itemIndex}].applicableCharacteristics[${relationshipIndex}].characteristicId`,
          itemIndex,
          rejectedValue: relationship?.characteristicId
        })
      }
    })
  })

  return errors
}

function validateCharacteristicDataTypes(characteristics) {
  return characteristics
    .map((characteristic, itemIndex) => ({ characteristic, itemIndex }))
    .filter(
      ({ characteristic }) =>
        !isSupportedCharacteristicDataType(characteristic?.dataType)
    )
    .map(({ characteristic, itemIndex }) => ({
      code: VALIDATION_ISSUE_CODE.UNSUPPORTED_CHARACTERISTIC_TYPE,
      message: `characteristics[${itemIndex}].dataType "${characteristic?.dataType}" is not one of the supported types (${GEAR_CHARACTERISTIC_DATA_TYPES.join(', ')}).`,
      path: `characteristics[${itemIndex}].dataType`,
      itemIndex,
      rejectedValue: characteristic?.dataType
    }))
}

function validateCharacteristicNumericRange(characteristics) {
  const errors = []

  characteristics.forEach((characteristic, itemIndex) => {
    const { minValue, maxValue } = characteristic ?? {}
    if (
      typeof minValue === 'number' &&
      typeof maxValue === 'number' &&
      minValue > maxValue
    ) {
      errors.push({
        code: VALIDATION_ISSUE_CODE.INVALID_NUMERIC_RANGE,
        message: `characteristics[${itemIndex}].minValue exceeds maxValue.`,
        path: `characteristics[${itemIndex}].minValue`,
        itemIndex,
        rejectedValue: minValue
      })
    }
  })

  return errors
}

function validateVesselLengthApplicability(items) {
  const errors = []

  items.forEach((item, itemIndex) => {
    const applicable = Array.isArray(item?.applicableCharacteristics)
      ? item.applicableCharacteristics
      : []

    applicable.forEach((relationship, relationshipIndex) => {
      const bands = relationship?.vesselLengthApplicability
      const path = `items[${itemIndex}].applicableCharacteristics[${relationshipIndex}].vesselLengthApplicability`

      if (!Array.isArray(bands) || bands.length === 0) {
        errors.push({
          code: VALIDATION_ISSUE_CODE.MISSING_APPLICABILITY,
          message: `${path} must enable at least one vessel-length band.`,
          path,
          itemIndex
        })
        return
      }

      bands
        .filter((band) => !isSupportedVesselLengthBand(band))
        .forEach((band) => {
          errors.push({
            code: VALIDATION_ISSUE_CODE.INVALID_ENUM_VALUE,
            message: `${path} contains unsupported band "${band}".`,
            path,
            itemIndex,
            rejectedValue: band
          })
        })
    })
  })

  return errors
}

/**
 * Gear-specific business rules (Step 09). `fixed` and `required` are read-only,
 * independent canonical flags: nothing is validated or reinterpreted about them here.
 */
export function validateGearsCollection(collection) {
  const items = Array.isArray(collection?.items) ? collection.items : []
  const categories = Array.isArray(collection?.categories)
    ? collection.categories
    : []
  const characteristics = Array.isArray(collection?.characteristics)
    ? collection.characteristics
    : []

  const errors = [
    ...validateCodeUniqueness(items, 'items'),
    ...validateCodeUniqueness(categories, 'categories'),
    ...validateCodeUniqueness(characteristics, 'characteristics'),
    ...validateCategoryReferences(items, categories),
    ...validateCharacteristicReferences(items, characteristics),
    ...validateCharacteristicDataTypes(characteristics),
    ...validateCharacteristicNumericRange(characteristics),
    ...validateVesselLengthApplicability(items)
  ]

  return { valid: errors.length === 0, errors, warnings: [] }
}
