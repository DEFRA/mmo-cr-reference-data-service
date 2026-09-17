// Step 17: gear mobile projection. Resolves categories/characteristics by GUID and
// maps applicable characteristics into required/variable measurement references.
// Pure; never mutates canonical gear/category/characteristic data.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

function raiseInternal(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INTERNAL_ERROR
  error.retryable = false
  throw error
}

export function buildGearLookupIndexes(collection) {
  return {
    categoriesById: new Map(
      collection.categories.map((category) => [category.id, category])
    ),
    characteristicsById: new Map(
      collection.characteristics.map((characteristic) => [
        characteristic.id,
        characteristic
      ])
    )
  }
}

function resolveCategory(gear, categoriesById) {
  const category = categoriesById.get(gear.categoryId)
  if (!category) {
    raiseInternal(`Gear "${gear.id}" references an unresolved category`)
  }
  return { id: category.id, code: category.code, name: category.name }
}

// Only characteristics applicable to `vesselLengthBand` are included when supplied;
// with no band, every applicable characteristic is included.
function selectApplicableCharacteristics(gear, vesselLengthBand) {
  return gear.applicableCharacteristics.filter(
    (entry) =>
      !vesselLengthBand ||
      !entry.vesselLengthApplicability ||
      entry.vesselLengthApplicability.includes(vesselLengthBand)
  )
}

// Documented mapping decision (Step 17 plan): required && fixed -> required;
// fixed === false -> variable; fixed === true && required === false is also
// treated as variable (an optional, fixed-type measurement) rather than silently
// discarded, since no distinct approved field exists for that combination.
function splitMeasurementIds(applicable) {
  const requiredMeasurementIds = []
  const variableMeasurementIds = []
  for (const entry of applicable) {
    if (entry.fixed && entry.required) {
      requiredMeasurementIds.push(entry.characteristicId)
    } else {
      variableMeasurementIds.push(entry.characteristicId)
    }
  }
  return { requiredMeasurementIds, variableMeasurementIds }
}

export function projectMeasurement(characteristic) {
  return {
    id: characteristic.id,
    code: characteristic.code,
    label: characteristic.name,
    kind: characteristic.dataType,
    unit: characteristic.unit ?? null,
    minimumValue: characteristic.minValue ?? null,
    maximumValue: characteristic.maxValue ?? null
  }
}

export function projectGearToMobile(
  gear,
  {
    categoriesById,
    characteristicsById: _characteristicsById,
    vesselLengthBand
  } = {}
) {
  const applicable = selectApplicableCharacteristics(gear, vesselLengthBand)
  const { requiredMeasurementIds, variableMeasurementIds } =
    splitMeasurementIds(applicable)

  return {
    id: gear.id,
    code: gear.code,
    name: gear.name,
    category: resolveCategory(gear, categoriesById),
    pairFishing: gear.pairFishing,
    requiredMeasurementIds,
    variableMeasurementIds,
    // internal use by the collection projector to build the page-specific `measurements` array
    __referencedCharacteristicIds: applicable.map(
      (entry) => entry.characteristicId
    )
  }
}

export function collectPageMeasurements(mobileItems, characteristicsById) {
  const seen = new Set()
  const measurements = []
  for (const item of mobileItems) {
    for (const characteristicId of item.__referencedCharacteristicIds ?? []) {
      if (seen.has(characteristicId)) {
        continue
      }
      seen.add(characteristicId)
      const characteristic = characteristicsById.get(characteristicId)
      if (characteristic) {
        measurements.push(projectMeasurement(characteristic))
      }
    }
  }
  return measurements
}

export function stripInternalProjectionFields(mobileItem) {
  const { __referencedCharacteristicIds, ...rest } = mobileItem
  return rest
}
