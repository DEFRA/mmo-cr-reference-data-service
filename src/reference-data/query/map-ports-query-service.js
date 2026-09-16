// Step 18: dedicated map-ports query use case. Reads the active `ports` snapshot
// directly from the In-Memory Data Store — bypasses the generic collection engine
// entirely (owner decision, 2026-09-16), since map-ports is a derived GeoJSON
// projection, not a queryable/filterable/paginated JSON collection.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { DATASETS } from '#/common/domain/datasets.js'
import { parseBoundingBox } from './bounding-box.js'
import { projectPortsToMapPorts } from './map-ports-projector.js'
import { calculateDeterministicEtag } from './result-etag.js'

const RECOGNISED_KEYS = new Set(['bbox'])

function raise(code, message) {
  const error = new Error(message)
  error.code = code
  error.retryable = code === SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE
  throw error
}

function parseMapPortsQuery(rawQuery = {}) {
  const unsupported = Object.keys(rawQuery).filter(
    (key) => !RECOGNISED_KEYS.has(key)
  )
  if (unsupported.length > 0) {
    const error = new Error(
      `Unsupported query parameter(s): ${unsupported.join(', ')}`
    )
    error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
    error.retryable = false
    throw error
  }
  return rawQuery.bbox === undefined ? null : parseBoundingBox(rawQuery.bbox)
}

export function createMapPortsQueryService({ store }) {
  function getMapPorts(rawQuery = {}) {
    const collection = store.getCollection(DATASETS.PORTS)
    const metadata = store.getCollectionMetadata(DATASETS.PORTS)
    if (collection === undefined || metadata === undefined) {
      raise(
        SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
        'ports is not currently available.'
      )
    }

    const bbox = parseMapPortsQuery(rawQuery)
    const body = projectPortsToMapPorts(collection, metadata, { bbox })

    return {
      etag: calculateDeterministicEtag({
        collectionId: metadata.collectionId,
        version: metadata.version,
        bbox
      }),
      body
    }
  }

  return { getMapPorts }
}
