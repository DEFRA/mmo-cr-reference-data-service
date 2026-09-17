// Step 15: pure collection query engine. Operates only on plain arrays supplied by the
// caller (via the In-Memory Data Store) and a QueryConfiguration — no Hapi, AWS SDK, or
// Authentication Service dependency, and never mutates its inputs.

function getFieldValue(record, accessor) {
  return typeof accessor === 'function' ? accessor(record) : undefined
}

function applyActiveFilter(records, config, includeInactive) {
  if (!config.activeField || includeInactive) {
    return records
  }
  return records.filter((record) => config.activeField(record) !== false)
}

function applyIdsFilter(records, config, ids) {
  if (!ids) {
    return records
  }
  const idSet = new Set(ids)
  return records.filter((record) => idSet.has(config.getGuid(record)))
}

function applyExactFilters(records, config, exactFilterValues) {
  const entries = Object.entries(exactFilterValues)
  if (entries.length === 0) {
    return records
  }
  return records.filter((record) =>
    entries.every(([param, expected]) => {
      const filter = config.exactFilters.find((f) => f.param === param)
      const actual = getFieldValue(record, filter.getValue)
      if (actual === null || actual === undefined) {
        return false
      }
      if (filter.caseInsensitive) {
        return String(actual).toLowerCase() === expected.toLowerCase()
      }
      return String(actual) === expected
    })
  )
}

function applyCustomFilters(records, config, customFilterValues) {
  const entries = Object.entries(customFilterValues)
  if (entries.length === 0) {
    return records
  }
  return records.filter((record) =>
    entries.every(([param, value]) =>
      config.customFilters[param].predicate(record, value)
    )
  )
}

function applyCompositeFilters(records, config, compositeFilterValues) {
  const entries = Object.entries(compositeFilterValues)
  if (entries.length === 0) {
    return records
  }
  return records.filter((record) =>
    entries.every(([name, value]) => {
      const filter = config.compositeFilters.find((f) => f.name === name)
      return filter.predicate(record, value)
    })
  )
}

function applyFreeText(records, config, freeText) {
  if (!freeText || config.textSearchFields.length === 0) {
    return records
  }
  const needle = freeText.toLowerCase()
  return records.filter((record) =>
    config.textSearchFields.some((accessor) => {
      const value = getFieldValue(record, accessor)
      return typeof value === 'string' && value.toLowerCase().includes(needle)
    })
  )
}

function compareValues(a, b) {
  if (a === b) {
    return 0
  }
  if (a === null || a === undefined) {
    return 1
  }
  if (b === null || b === undefined) {
    return -1
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase().localeCompare(b.toLowerCase())
  }
  return a < b ? -1 : 1
}

function buildSortSteps(config, requestedSort) {
  const steps = requestedSort ? [requestedSort] : config.defaultSort
  // A GUID tie-break is always appended so ordering is fully deterministic.
  return [...steps, { field: '__guid__', direction: 'asc' }]
}

function sortRecords(records, config, requestedSort) {
  const steps = buildSortSteps(config, requestedSort)
  const accessorFor = (field) =>
    field === '__guid__' ? config.getGuid : config.sortFields[field]

  // Sorts a shallow copy; the caller's array/order is never mutated.
  return [...records].sort((a, b) => {
    for (const step of steps) {
      const accessor = accessorFor(step.field)
      const comparison = compareValues(accessor(a), accessor(b))
      if (comparison !== 0) {
        return step.direction === 'desc' ? -comparison : comparison
      }
    }
    return 0
  })
}

function applyPagination(records, config, parsedRequest) {
  if (
    parsedRequest.isFullCollectionRequest ||
    !config.pagination.allowPagination
  ) {
    return records
  }
  return records.slice(
    parsedRequest.offset,
    parsedRequest.offset + parsedRequest.limit
  )
}

/**
 * @param {{config: object, records: object[], parsedRequest: object}} input
 * @returns {{ totalCount: number, items: object[], offset?: number, limit?: number, isFullCollectionRequest: boolean }}
 */
export function runCollectionQuery({ config, records, parsedRequest }) {
  let filtered = applyActiveFilter(
    records,
    config,
    parsedRequest.includeInactive
  )
  filtered = applyIdsFilter(filtered, config, parsedRequest.ids)
  filtered = applyExactFilters(filtered, config, parsedRequest.exactFilters)
  filtered = applyCustomFilters(
    filtered,
    config,
    parsedRequest.customFilterValues
  )
  filtered = applyCompositeFilters(
    filtered,
    config,
    parsedRequest.compositeFilterValues
  )
  filtered = applyFreeText(filtered, config, parsedRequest.freeText)

  const totalCount = filtered.length
  const sorted = sortRecords(filtered, config, parsedRequest.sort)
  const items = applyPagination(sorted, config, parsedRequest)

  return {
    totalCount,
    items,
    ...(parsedRequest.isFullCollectionRequest ||
    !config.pagination.allowPagination
      ? {}
      : { offset: parsedRequest.offset, limit: parsedRequest.limit }),
    isFullCollectionRequest: parsedRequest.isFullCollectionRequest
  }
}
