// Step 16: vessel query configuration built on the Step 15 common query engine.

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { projectVesselToMobile } from './vessels-mobile-projector.js'

const IDENTIFIER_FILTERS = [
  { param: 'cfr', field: 'cfr', caseInsensitive: true },
  { param: 'uvi', field: 'uvi', caseInsensitive: true },
  { param: 'mmsi', field: 'mmsi', caseInsensitive: false },
  { param: 'ircs', field: 'ircs', caseInsensitive: true },
  { param: 'externalMark', field: 'externalMark', caseInsensitive: true },
  {
    param: 'registrationNumber',
    field: 'registrationNumber',
    caseInsensitive: true
  }
]

export const vesselsQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.VESSELS,
  format: 'json',
  getGuid: (vessel) => vessel.id,
  exactFilters: IDENTIFIER_FILTERS.map((filter) => ({
    param: filter.param,
    caseInsensitive: filter.caseInsensitive,
    getValue: (vessel) => vessel.identifiers?.[filter.field]
  })),
  textSearchFields: [
    (vessel) => vessel.name,
    (vessel) => vessel.namePln,
    (vessel) => vessel.identifiers?.cfr,
    (vessel) => vessel.identifiers?.uvi,
    (vessel) => vessel.identifiers?.mmsi,
    (vessel) => vessel.identifiers?.ircs,
    (vessel) => vessel.identifiers?.externalMark,
    (vessel) => vessel.identifiers?.registrationNumber
  ],
  sortFields: {
    name: (vessel) => vessel.name,
    namePln: (vessel) => vessel.namePln,
    cfr: (vessel) => vessel.identifiers?.cfr,
    externalMark: (vessel) => vessel.identifiers?.externalMark,
    registrationNumber: (vessel) => vessel.identifiers?.registrationNumber,
    lengthOverallMetres: (vessel) => vessel.lengthOverallMetres
  },
  defaultSort: [{ field: 'name', direction: 'asc' }],
  // "status" is a free-form string (Step 04); only the literal "active" is treated
  // as the active state for the common includeInactive filter.
  activeField: (vessel) => vessel.status === 'active',
  mobileProjector: (vessel) => projectVesselToMobile(vessel)
})
