// Enriches the canonical (standard) gear response so a consumer never has to cross-
// reference a bare `categoryId`/`characteristicId` against a separate request. Purely
// additive: every pre-existing field is preserved unchanged, new `category`/
// `measurement` objects are resolved from the same lookup indexes the mobile
// projector already uses. Pure; never mutates canonical gear/category/characteristic
// data.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

function raiseInternal(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INTERNAL_ERROR
  error.retryable = false
  throw error
}

export function resolveStandardCategory(categoryId, categoriesById) {
  const category = categoriesById.get(categoryId)
  if (!category) {
    raiseInternal(
      `Gear category "${categoryId}" does not resolve to a known category`
    )
  }
  return { id: category.id, code: category.code, name: category.name }
}

export function resolveStandardMeasurement(
  characteristicId,
  characteristicsById
) {
  const characteristic = characteristicsById.get(characteristicId)
  if (!characteristic) {
    raiseInternal(
      `Gear characteristic "${characteristicId}" does not resolve to a known characteristic`
    )
  }
  return {
    id: characteristic.id,
    code: characteristic.code,
    name: characteristic.name,
    unit: characteristic.unit ?? null,
    dataType: characteristic.dataType,
    minValue: characteristic.minValue ?? null,
    maxValue: characteristic.maxValue ?? null
  }
}

export function projectApplicableCharacteristicToStandard(
  entry,
  characteristicsById
) {
  return {
    ...entry,
    measurement: resolveStandardMeasurement(
      entry.characteristicId,
      characteristicsById
    )
  }
}

export function projectGearToStandard(
  gear,
  { categoriesById, characteristicsById } = {}
) {
  return {
    ...gear,
    category: resolveStandardCategory(gear.categoryId, categoriesById),
    applicableCharacteristics: gear.applicableCharacteristics.map((entry) =>
      projectApplicableCharacteristicToStandard(entry, characteristicsById)
    )
  }
}
