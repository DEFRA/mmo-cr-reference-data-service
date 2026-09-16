// Parses/validates the Manifest API `include` query parameter. Reused nowhere else
// yet, but kept dataset-registry-driven so later steps' query filters can follow
// the same pattern.

import { DATASETS, isPersistedDataset } from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

// Only persisted (manifest-eligible) datasets are valid include values — derived
// `map-ports` can never appear in a manifest entry, so requesting it is treated
// the same as any other unsupported value rather than silently returning nothing.
const PERSISTABLE_DATASETS = Object.values(DATASETS).filter(isPersistedDataset)
const MAX_INCLUDE_LENGTH = 200
const MAX_INCLUDE_COUNT = PERSISTABLE_DATASETS.length

function raiseInvalidInclude(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

/**
 * @param {string|undefined} rawValue raw `include` query value
 * @returns {string[]|null} null means "no filter, return every dataset"
 */
export function parseIncludeFilter(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null
  }
  if (typeof rawValue !== 'string') {
    raiseInvalidInclude('The include query parameter must be a string.')
  }
  if (rawValue.length === 0 || rawValue.length > MAX_INCLUDE_LENGTH) {
    raiseInvalidInclude(
      'The include query parameter must not be empty or excessively long.'
    )
  }

  const values = rawValue.split(',').map((value) => value.trim())
  if (values.some((value) => value.length === 0)) {
    raiseInvalidInclude('The include query parameter contains an empty value.')
  }
  if (values.length > MAX_INCLUDE_COUNT) {
    raiseInvalidInclude('The include query parameter lists too many datasets.')
  }

  // Duplicate values are silently de-duplicated (documented policy) rather than rejected.
  const uniqueValues = [...new Set(values)]
  const unsupportedValues = uniqueValues.filter(
    (value) => !PERSISTABLE_DATASETS.includes(value)
  )
  if (unsupportedValues.length > 0) {
    raiseInvalidInclude(
      `Unsupported dataset(s) in include: ${unsupportedValues.join(', ')}`
    )
  }

  return uniqueValues
}
