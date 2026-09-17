// Step 19: species query configuration (owner-approved decisions, 2026-09-16).
// countryCode is deliberately dual-purpose: the same parsed custom-filter value is
// both the species filter and the requested-country context for mobile name
// resolution, via the existing Step 15/17 customFilterValues -> projection-context
// merge — no new plumbing required.

import { createQueryConfiguration } from './query-configuration.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { projectSpeciesToMobile } from './species-mobile-projector.js'

const MAX_FILTER_VALUE_LENGTH = 200

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

// Custom filters own their own input validation (unlike exactFilters, whose
// trim/empty/length checks are applied centrally by the shared parser).
function parseFilterString(rawValue, label) {
  if (typeof rawValue !== 'string') {
    raiseInvalid(`${label} must be a string`)
  }
  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    raiseInvalid(`${label} must not be empty`)
  }
  if (trimmed.length > MAX_FILTER_VALUE_LENGTH) {
    raiseInvalid(`${label} is too long`)
  }
  return trimmed
}

function enrichSpecies(species) {
  return {
    ...species,
    _commonNamesText: species.commonNames.map((cn) => cn.name).join(' '),
    _localNamesText: species.localNames.map((ln) => ln.name).join(' ')
  }
}

export const speciesQueryConfiguration = createQueryConfiguration({
  dataset: DATASETS.SPECIES,
  format: 'json',
  getGuid: (species) => species.id,
  prepareRecords: (records) => records.map(enrichSpecies),
  // FAO code and scientific name are exact, case-insensitive scalar-field matches.
  exactFilters: [
    {
      param: 'faoCode',
      caseInsensitive: true,
      getValue: (species) => species.faoCode
    },
    {
      param: 'scientificName',
      caseInsensitive: true,
      getValue: (species) => species.scientificName
    }
  ],
  // countryCode/languageCode match against nested arrays, so they cannot be plain
  // scalar exactFilters; both are exact, case-insensitive, "at least one entry
  // matches" predicates.
  customFilters: {
    countryCode: {
      parse: (raw) => parseFilterString(raw, 'countryCode'),
      predicate: (species, value) =>
        species.commonNames.some(
          (cn) => cn.countryCode.toLowerCase() === value.toLowerCase()
        )
    },
    languageCode: {
      parse: (raw) => parseFilterString(raw, 'languageCode'),
      predicate: (species, value) =>
        species.localNames.some(
          (ln) => ln.languageCode.toLowerCase() === value.toLowerCase()
        )
    }
  },
  textSearchFields: [
    (species) => species.faoCode,
    (species) => species.scientificName,
    (species) => species._commonNamesText,
    (species) => species._localNamesText
  ],
  sortFields: {
    faoCode: (species) => species.faoCode,
    scientificName: (species) => species.scientificName
  },
  defaultSort: [{ field: 'scientificName', direction: 'asc' }],
  activeField: (species) => species.active,
  mobileProjector: (species, context) =>
    projectSpeciesToMobile(species, context)
})
