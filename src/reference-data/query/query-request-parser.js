import { guidSchema } from '#/common/schemas/fragments/guid.js'
import {
  REPRESENTATIONS,
  isSupportedRepresentation
} from '#/common/domain/representations.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const MAX_TEXT_LENGTH = 200
const MAX_IDS = 50
const MAX_FILTER_VALUE_LENGTH = 200

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

function isGuid(value) {
  return typeof value === 'string' && !guidSchema.validate(value).error
}

function parseView(rawView) {
  if (rawView === undefined) {
    return REPRESENTATIONS.CANONICAL
  }
  if (!isSupportedRepresentation(rawView)) {
    raiseInvalid(`Unsupported view: ${rawView}`)
  }
  return rawView
}

function parseFreeText(rawQuery) {
  if (rawQuery === undefined) {
    return null
  }
  if (typeof rawQuery !== 'string') {
    raiseInvalid('query must be a string')
  }
  const trimmed = rawQuery.trim()
  if (trimmed.length === 0) {
    raiseInvalid('query must not be empty')
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    raiseInvalid('query is too long')
  }
  return trimmed
}

function parseIds(rawIds) {
  if (rawIds === undefined) {
    return null
  }
  if (typeof rawIds !== 'string' || rawIds.trim().length === 0) {
    raiseInvalid('ids must be a non-empty comma-separated list')
  }
  const values = rawIds.split(',').map((value) => value.trim())
  if (values.some((value) => value.length === 0)) {
    raiseInvalid('ids contains an empty value')
  }
  if (values.length > MAX_IDS) {
    raiseInvalid('ids lists too many values')
  }
  const invalid = values.filter((value) => !isGuid(value))
  if (invalid.length > 0) {
    raiseInvalid(`ids contains invalid GUID(s): ${invalid.join(', ')}`)
  }
  return [...new Set(values)]
}

function parseExactFilters(rawQuery, config) {
  const values = {}
  for (const filter of config.exactFilters) {
    const raw = rawQuery[filter.param]
    if (raw === undefined) {
      continue
    }
    if (typeof raw !== 'string') {
      raiseInvalid(`${filter.param} must be a string`)
    }
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      raiseInvalid(`${filter.param} must not be empty`)
    }
    if (trimmed.length > MAX_FILTER_VALUE_LENGTH) {
      raiseInvalid(`${filter.param} is too long`)
    }
    values[filter.param] = trimmed
  }
  return values
}

function parseCustomFilters(rawQuery, config) {
  const values = {}
  for (const [param, filter] of Object.entries(config.customFilters)) {
    if (rawQuery[param] === undefined) {
      continue
    }
    values[param] = filter.parse(rawQuery[param], rawQuery)
  }
  return values
}

// All-or-none: a composite filter's params must be supplied together, and its
// `parse` runs exactly once (never per-param), producing one value for `predicate`.
function parseCompositeFilters(rawQuery, config) {
  const values = {}
  for (const filter of config.compositeFilters) {
    const suppliedParams = filter.params.filter(
      (param) => rawQuery[param] !== undefined
    )
    if (suppliedParams.length === 0) {
      continue
    }
    if (suppliedParams.length !== filter.params.length) {
      raiseInvalid(`${filter.params.join(', ')} must be supplied together`)
    }
    values[filter.name] = filter.parse(rawQuery)
  }
  return values
}

function parseIncludeInactive(rawValue) {
  if (rawValue === undefined) {
    return false
  }
  if (rawValue === 'true') {
    return true
  }
  if (rawValue === 'false') {
    return false
  }
  return raiseInvalid('includeInactive must be "true" or "false"')
}

function parseSort(rawSort, config) {
  if (rawSort === undefined) {
    return null
  }
  if (typeof rawSort !== 'string' || rawSort.trim().length === 0) {
    raiseInvalid('sort must be a non-empty string')
  }
  const direction = rawSort.startsWith('-') ? 'desc' : 'asc'
  const field = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort
  if (!(field in config.sortFields)) {
    raiseInvalid(`Unsupported sort field: ${field}`)
  }
  return { field, direction }
}

function parseStrictNonNegativeInteger(rawValue, label) {
  if (rawValue === undefined) {
    return undefined
  }
  if (!/^\d+$/.test(rawValue)) {
    raiseInvalid(`${label} must be a non-negative integer`)
  }
  return Number.parseInt(rawValue, 10)
}

function parsePagination(rawQuery, config) {
  const offset = parseStrictNonNegativeInteger(rawQuery.offset, 'offset') ?? 0
  const rawLimit = parseStrictNonNegativeInteger(rawQuery.limit, 'limit')
  const limit = rawLimit ?? config.pagination.defaultLimit
  if (limit === 0) {
    raiseInvalid('limit must be greater than zero')
  }
  if (limit > config.pagination.maxLimit) {
    raiseInvalid(`limit must not exceed ${config.pagination.maxLimit}`)
  }
  return { offset, limit }
}

/**
 * Parses a plain query-string object (e.g. Hapi's `request.query`) into the
 * internal collection-query request shape. Throws `invalid_request` for any
 * unsupported or malformed input. Never mutates `rawQuery`.
 */
export function parseCollectionQuery(config, rawQuery = {}) {
  const recognisedKeys = new Set([
    'view',
    'query',
    'ids',
    'includeInactive',
    'sort',
    'offset',
    'limit',
    ...config.exactFilters.map((filter) => filter.param),
    ...Object.keys(config.customFilters),
    ...config.compositeFilters.flatMap((filter) => filter.params)
  ])

  const unsupported = Object.keys(rawQuery).filter(
    (key) => !recognisedKeys.has(key)
  )
  if (unsupported.length > 0) {
    raiseInvalid(`Unsupported query parameter(s): ${unsupported.join(', ')}`)
  }

  const nonViewKeys = Object.keys(rawQuery).filter((key) => key !== 'view')
  const isFullCollectionRequest = nonViewKeys.length === 0

  return {
    view: parseView(rawQuery.view),
    freeText: parseFreeText(rawQuery.query),
    ids: parseIds(rawQuery.ids),
    exactFilters: parseExactFilters(rawQuery, config),
    customFilterValues: parseCustomFilters(rawQuery, config),
    compositeFilterValues: parseCompositeFilters(rawQuery, config),
    includeInactive: parseIncludeInactive(rawQuery.includeInactive),
    sort: parseSort(rawQuery.sort, config),
    ...parsePagination(rawQuery, config),
    isFullCollectionRequest
  }
}
