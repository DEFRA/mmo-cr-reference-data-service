// Step 15: Query Module use cases built on top of the common engine. Reads active
// data only through the injected In-Memory Data Store — never persistence, never the
// authentication client, never the Cache Refresh Module.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { REPRESENTATIONS } from '#/common/domain/representations.js'
import { parseCollectionQuery } from './query-request-parser.js'
import { runCollectionQuery } from './collection-query-engine.js'
import { calculateDeterministicEtag } from './result-etag.js'

function raise(code, message) {
  const error = new Error(message)
  error.code = code
  error.retryable = code === SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
  throw error
}

function getRawRecords(collection, config) {
  return config.format === 'geojson' ? collection.features : collection.items
}

// prepareRecords enrichment (e.g. denormalised search fields) is for internal
// filter/search/sort matching only; output must always reflect the original raw
// record, in every view, so internal fields never leak into API responses.
function getPreparedRecords(rawRecords, collection, config) {
  return config.prepareRecords
    ? config.prepareRecords(rawRecords, collection)
    : rawRecords
}

function buildRawRecordLookup(rawRecords, config) {
  return new Map(rawRecords.map((record) => [config.getGuid(record), record]))
}

function buildProjectionContext(
  collection,
  config,
  parsedRequest,
  projectionContext
) {
  return {
    ...(config.buildContext ? config.buildContext(collection) : {}),
    ...projectionContext,
    ...parsedRequest.customFilterValues
  }
}

function projectRecord(record, config, view, context) {
  if (view !== REPRESENTATIONS.MOBILE) {
    return record
  }
  if (!config.mobileProjector) {
    raise(
      SERVICE_ERROR_CODES.INTERNAL_ERROR,
      `No mobile projector configured for dataset "${config.dataset}"`
    )
  }
  return config.mobileProjector(record, context)
}

// Deterministic, request-shape-sensitive ETag: two requests producing the same
// filtered view of the same collection revision get the same ETag; a changed
// collection or a materially different request never collides.
function calculateResultEtag(metadata, parsedRequest) {
  return calculateDeterministicEtag({
    collectionId: metadata.collectionId,
    version: metadata.version,
    request: parsedRequest
  })
}

function loadSnapshot(store, dataset) {
  const collection = store.getCollection(dataset)
  const metadata = store.getCollectionMetadata(dataset)
  if (collection === undefined || metadata === undefined) {
    raise(
      SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
      `${dataset} is not currently available.`
    )
  }
  return { collection, metadata }
}

/**
 * Creates an isolated Collection Query Module instance for full-collection/search/
 * item-by-GUID use cases shared by every dataset endpoint (Steps 16-20).
 */
export function createCollectionQueryService({ store }) {
  function queryCollection(config, rawQuery, projectionContext = {}) {
    const { collection, metadata } = loadSnapshot(store, config.dataset)
    const parsedRequest = parseCollectionQuery(config, rawQuery)
    const rawRecords = getRawRecords(collection, config)
    const records = getPreparedRecords(rawRecords, collection, config)
    const rawByGuid = buildRawRecordLookup(rawRecords, config)
    const result = runCollectionQuery({ config, records, parsedRequest })
    const context = buildProjectionContext(
      collection,
      config,
      parsedRequest,
      projectionContext
    )

    return {
      etag: calculateResultEtag(metadata, parsedRequest),
      metadata,
      view: parsedRequest.view,
      context,
      totalCount: result.totalCount,
      offset: result.offset,
      limit: result.limit,
      isFullCollectionRequest: result.isFullCollectionRequest,
      items: result.items.map((record) =>
        projectRecord(
          rawByGuid.get(config.getGuid(record)),
          config,
          parsedRequest.view,
          context
        )
      )
    }
  }

  function getItemById(config, id, rawQuery, projectionContext = {}) {
    const { collection, metadata } = loadSnapshot(store, config.dataset)
    const parsedRequest = parseCollectionQuery(config, { ...rawQuery, ids: id })
    const rawRecords = getRawRecords(collection, config)
    const match = rawRecords.find((record) => config.getGuid(record) === id)

    if (!match) {
      raise(
        SERVICE_ERROR_CODES.REFERENCE_ITEM_NOT_FOUND,
        `No ${config.dataset} item found for id "${id}".`
      )
    }

    const context = buildProjectionContext(
      collection,
      config,
      parsedRequest,
      projectionContext
    )

    return {
      etag: calculateResultEtag(metadata, { ...parsedRequest, ids: [id] }),
      metadata,
      view: parsedRequest.view,
      context,
      item: projectRecord(match, config, parsedRequest.view, context)
    }
  }

  return { queryCollection, getItemById }
}
