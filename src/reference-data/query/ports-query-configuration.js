// Step 18: port query configuration built on the Step 15 common query engine.
// Location/radius search is one explicit composite filter, not three independent
// no-op custom filters (owner decision, 2026-09-16).

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import {
  parseLocationSearch,
  matchesLocationSearch
} from './location-search.js'

function projectPortToMobile(port) {
  return {
    id: port.id,
    code: port.code,
    name: port.name,
    displayName: port.name,
    coordinate: port.coordinate ?? null
  }
}

export const portsQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.PORTS,
  format: 'json',
  getGuid: (port) => port.id,
  // Port codes are exact, case-sensitive, and never parsed as numbers (leading
  // zeros preserved). Country codes are case-insensitive.
  exactFilters: [
    { param: 'code', caseInsensitive: false, getValue: (port) => port.code },
    {
      param: 'countryCode',
      caseInsensitive: true,
      getValue: (port) => port.countryCode
    }
  ],
  compositeFilters: [
    {
      name: 'location',
      params: ['latitude', 'longitude', 'radiusKm'],
      parse: (rawQuery) => parseLocationSearch(rawQuery),
      predicate: (port, location) =>
        matchesLocationSearch(port.coordinate, location)
    }
  ],
  textSearchFields: [
    (port) => port.name,
    (port) => port.code,
    (port) => port.countryCode
  ],
  sortFields: {
    name: (port) => port.name,
    code: (port) => port.code,
    countryCode: (port) => port.countryCode
  },
  defaultSort: [{ field: 'name', direction: 'asc' }],
  activeField: (port) => port.active,
  mobileProjector: (port) => projectPortToMobile(port)
})
