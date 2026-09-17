// Step 17: gear query configuration. `prepareRecords` denormalises category code/name
// and referenced characteristic names/codes onto each gear (new objects only, never
// mutating the canonical collection) so exact filters and free-text search can use
// simple field accessors; `buildContext` exposes the lookup indexes to the projector.

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import {
  buildGearLookupIndexes,
  projectGearToMobile
} from './gears-mobile-projector.js'
import {
  parseVesselLengthMetres,
  resolveVesselLengthBand
} from './vessel-length-band.js'

function enrichGear(gear, categoriesById, characteristicsById) {
  const category = categoriesById.get(gear.categoryId)
  const characteristics = gear.applicableCharacteristics
    .map((entry) => characteristicsById.get(entry.characteristicId))
    .filter(Boolean)

  return {
    ...gear,
    _categoryCode: category?.code ?? null,
    _categoryName: category?.name ?? null,
    _searchableCharacteristics: characteristics
      .map((characteristic) => `${characteristic.name} ${characteristic.code}`)
      .join(' ')
  }
}

function parseBoolean(raw) {
  if (raw === 'true') {
    return true
  }
  if (raw === 'false') {
    return false
  }
  const error = new Error('pairFishing must be "true" or "false"')
  error.code = 'invalid_request'
  throw error
}

export const gearsQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.GEARS,
  format: 'json',
  getGuid: (gear) => gear.id,
  prepareRecords: (records, collection) => {
    const { categoriesById, characteristicsById } =
      buildGearLookupIndexes(collection)
    return records.map((gear) =>
      enrichGear(gear, categoriesById, characteristicsById)
    )
  },
  buildContext: (collection) => buildGearLookupIndexes(collection),
  exactFilters: [
    { param: 'code', caseInsensitive: true, getValue: (gear) => gear.code },
    {
      param: 'categoryCode',
      caseInsensitive: true,
      getValue: (gear) => gear._categoryCode
    },
    {
      param: 'categoryId',
      caseInsensitive: false,
      getValue: (gear) => gear.categoryId
    }
  ],
  customFilters: {
    pairFishing: {
      parse: parseBoolean,
      predicate: (gear, value) => gear.pairFishing === value
    },
    vesselLengthMetres: {
      parse: (raw) => parseVesselLengthMetres(raw),
      // Vessel length only narrows which characteristics are applicable within the
      // mobile projection; it never removes a gear from the result set.
      predicate: () => true
    }
  },
  textSearchFields: [
    (gear) => gear.name,
    (gear) => gear.code,
    (gear) => gear.type,
    (gear) => gear._categoryName,
    (gear) => gear._categoryCode,
    (gear) => gear._searchableCharacteristics
  ],
  sortFields: {
    name: (gear) => gear.name,
    code: (gear) => gear.code,
    type: (gear) => gear.type,
    categoryName: (gear) => gear._categoryName,
    categoryCode: (gear) => gear._categoryCode,
    pairFishing: (gear) => gear.pairFishing
  },
  defaultSort: [{ field: 'name', direction: 'asc' }],
  activeField: (gear) => gear.active,
  mobileProjector: (gear, context) =>
    projectGearToMobile(gear, {
      categoriesById: context.categoriesById,
      characteristicsById: context.characteristicsById,
      vesselLengthBand:
        context.vesselLengthMetres !== undefined
          ? resolveVesselLengthBand(context.vesselLengthMetres)
          : undefined
    })
})
