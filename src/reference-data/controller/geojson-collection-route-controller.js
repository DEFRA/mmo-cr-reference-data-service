// Shared Hapi request/response wiring for GeoJSON dataset endpoints backed by the
// generic Step 15 query engine (map-land, map-statistical-areas). Sibling to
// collection-route-controller.js rather than a modification of it, since the
// response shape (bare FeatureCollection/Feature, application/geo+json) differs from
// every canonical JSON dataset. map-ports (Step 18) is a separate, non-generic path
// and is not built on this controller.

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'
import { matchesIfNoneMatch } from '#/common/helpers/api/conditional-request.js'
import { requireReadAccess } from './read-access.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_MODIFIED = 304
const GEO_JSON_CONTENT_TYPE = 'application/geo+json'
const GEOJSON_CRS = 'EPSG:4326'

function buildFeatureCollectionBody(config, result) {
  return {
    type: 'FeatureCollection',
    metadata: {
      dataset: config.dataset,
      collectionId: result.metadata.collectionId,
      schemaVersion: result.metadata.schemaVersion,
      version: result.metadata.version,
      crs: GEOJSON_CRS,
      featureCount: result.totalCount
    },
    features: result.items
  }
}

function conditionalResponse(h, etag, body) {
  return {
    ifNoneMatch(ifNoneMatchHeader) {
      if (matchesIfNoneMatch(etag, ifNoneMatchHeader)) {
        return h
          .response()
          .code(HTTP_STATUS_NOT_MODIFIED)
          .header('ETag', etag)
          .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
      }
      return h
        .response(body)
        .code(HTTP_STATUS_OK)
        .type(GEO_JSON_CONTENT_TYPE)
        .header('ETag', etag)
        .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
    }
  }
}

/**
 * @param {{ config: object, query: object, authenticationClient: object }} deps
 */
export function createGeoJsonCollectionRouteController({
  config,
  query,
  authenticationClient
}) {
  async function collectionHandler(request, h) {
    await requireReadAccess(request, authenticationClient)
    const result = query.queryCollection(config, request.query)
    return conditionalResponse(
      h,
      result.etag,
      buildFeatureCollectionBody(config, result)
    ).ifNoneMatch(request.headers['if-none-match'])
  }

  async function itemHandler(request, h) {
    await requireReadAccess(request, authenticationClient)
    const result = query.getItemById(config, request.params.id, request.query)
    return conditionalResponse(h, result.etag, result.item).ifNoneMatch(
      request.headers['if-none-match']
    )
  }

  return { collectionHandler, itemHandler }
}
