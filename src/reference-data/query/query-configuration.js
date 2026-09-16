// Step 15: reusable dataset query-configuration mechanism. Each dataset step (16-20)
// registers one of these instead of modifying the common query engine.

function assertFunction(value, name) {
  if (typeof value !== 'function') {
    throw new Error(`Query configuration "${name}" must be a function`)
  }
}

function assertNoDuplicateNames(entries, label) {
  const seen = new Set()
  for (const name of entries) {
    if (seen.has(name)) {
      throw new Error(`Duplicate ${label} name: "${name}"`)
    }
    seen.add(name)
  }
}

/**
 * @param {Object} input
 * @param {string} input.dataset one of the DATASETS identifiers
 * @param {'json'|'geojson'} input.format
 * @param {(record: object) => string} input.getGuid
 * @param {Array<{param:string, getValue:(record:object)=>*, caseInsensitive?:boolean}>} [input.exactFilters]
 * @param {Array<(record:object)=>string|null|undefined>} [input.textSearchFields]
 * @param {Object.<string, {parse:(raw:string)=>*, predicate:(record:object,value:*)=>boolean}>} [input.customFilters]
 * @param {Array<{name:string, params:string[], parse:(rawQuery:object)=>*, predicate:(record:object,value:*)=>boolean}>} [input.compositeFilters]
 *   multi-parameter filters (e.g. lat/lon/radius) that must be supplied all-or-none;
 *   `parse` runs once, given the raw query object, only when every param is present.
 * @param {Object.<string, (record:object)=>*>} [input.sortFields]
 * @param {Array<{field:string, direction:'asc'|'desc'}>} [input.defaultSort]
 * @param {(record:object)=>boolean|undefined} [input.activeField]
 * @param {(record:object, context:object)=>object} [input.mobileProjector]
 * @param {{defaultLimit?:number, maxLimit?:number, allowPagination?:boolean}} [input.pagination]
 * @param {(records:object[], collection:object)=>object[]} [input.prepareRecords] optional
 *   per-request record enrichment (e.g. denormalising a lookup field); must return new
 *   objects rather than mutating its input.
 * @param {(collection:object)=>object} [input.buildContext] optional collection-derived
 *   projection context (e.g. lookup indexes), merged before per-request context.
 */
export function createQueryConfiguration({
  dataset,
  format,
  getGuid,
  exactFilters = [],
  textSearchFields = [],
  customFilters = {},
  compositeFilters = [],
  sortFields = {},
  defaultSort = [],
  activeField = null,
  mobileProjector = null,
  pagination = {},
  prepareRecords = null,
  buildContext = null
} = {}) {
  if (typeof dataset !== 'string' || dataset.length === 0) {
    throw new Error('Query configuration requires a non-empty "dataset"')
  }
  if (format !== 'json' && format !== 'geojson') {
    throw new Error(`Query configuration "format" must be "json" or "geojson"`)
  }
  assertFunction(getGuid, 'getGuid')

  assertNoDuplicateNames(
    exactFilters.map((filter) => filter.param),
    'exact filter param'
  )
  for (const filter of exactFilters) {
    assertFunction(filter.getValue, `exactFilters.${filter.param}.getValue`)
  }

  assertNoDuplicateNames(Object.keys(customFilters), 'custom filter param')
  for (const [param, filter] of Object.entries(customFilters)) {
    assertFunction(filter.parse, `customFilters.${param}.parse`)
    assertFunction(filter.predicate, `customFilters.${param}.predicate`)
  }

  const exactFilterParams = new Set(exactFilters.map((filter) => filter.param))
  const overlap = Object.keys(customFilters).filter((param) =>
    exactFilterParams.has(param)
  )
  if (overlap.length > 0) {
    throw new Error(
      `Custom filter param(s) conflict with exact filter param(s): ${overlap.join(', ')}`
    )
  }

  assertNoDuplicateNames(
    compositeFilters.map((filter) => filter.name),
    'composite filter name'
  )
  const singleParamNames = new Set([
    ...exactFilterParams,
    ...Object.keys(customFilters)
  ])
  const compositeParamNames = new Set()
  for (const filter of compositeFilters) {
    if (!Array.isArray(filter.params) || filter.params.length === 0) {
      throw new Error(
        `compositeFilters.${filter.name}.params must be a non-empty array`
      )
    }
    assertFunction(filter.parse, `compositeFilters.${filter.name}.parse`)
    assertFunction(
      filter.predicate,
      `compositeFilters.${filter.name}.predicate`
    )
    for (const param of filter.params) {
      if (singleParamNames.has(param) || compositeParamNames.has(param)) {
        throw new Error(
          `compositeFilters param "${param}" conflicts with an existing filter param`
        )
      }
      compositeParamNames.add(param)
    }
  }

  for (const accessor of Object.values(sortFields)) {
    assertFunction(accessor, 'sortFields entry')
  }
  if (activeField !== null) {
    assertFunction(activeField, 'activeField')
  }
  if (mobileProjector !== null) {
    assertFunction(mobileProjector, 'mobileProjector')
  }
  if (prepareRecords !== null) {
    assertFunction(prepareRecords, 'prepareRecords')
  }
  if (buildContext !== null) {
    assertFunction(buildContext, 'buildContext')
  }

  return Object.freeze({
    dataset,
    format,
    getGuid,
    prepareRecords,
    buildContext,
    exactFilters: Object.freeze(exactFilters),
    textSearchFields: Object.freeze(textSearchFields),
    customFilters: Object.freeze(customFilters),
    compositeFilters: Object.freeze(compositeFilters),
    sortFields: Object.freeze(sortFields),
    defaultSort: Object.freeze(defaultSort),
    activeField,
    mobileProjector,
    pagination: Object.freeze({
      defaultLimit: pagination.defaultLimit ?? 50,
      maxLimit: pagination.maxLimit ?? 500,
      allowPagination: pagination.allowPagination ?? true
    })
  })
}
