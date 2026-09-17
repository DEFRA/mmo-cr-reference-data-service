// Shared Hapi request/response wiring reused by every canonical JSON dataset endpoint
// (vessels, gears, ports, species). Owns transport concerns only — all retrieval,
// filtering, and projection logic lives in the Query Module (Step 15 engine).

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'
import { matchesIfNoneMatch } from '#/common/helpers/api/conditional-request.js'
import { requireReadAccess } from './read-access.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_MODIFIED = 304

function buildCollectionBody(config, result) {
  return {
    dataset: config.dataset,
    collectionId: result.metadata.collectionId,
    schemaVersion: result.metadata.schemaVersion,
    version: result.metadata.version,
    view: result.view,
    total: result.totalCount,
    ...(result.offset !== undefined
      ? { offset: result.offset, limit: result.limit }
      : {}),
    items: result.items
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
        .header('ETag', etag)
        .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
    }
  }
}

/**
 * @param {{ dataset: string, config: object, query: object, authenticationClient: object, getProjectionContext?: (request:object)=>object, postProcessCollectionBody?: (body:object, result:object)=>object, postProcessItemBody?: (body:object, result:object)=>object }} deps
 */
export function createCollectionRouteController({
  config,
  query,
  authenticationClient,
  getProjectionContext = () => ({}),
  postProcessCollectionBody = (body) => body,
  postProcessItemBody = (body) => body
}) {
  async function collectionHandler(request, h) {
    await requireReadAccess(request, authenticationClient)
    const result = query.queryCollection(
      config,
      request.query,
      getProjectionContext(request)
    )
    const body = postProcessCollectionBody(
      buildCollectionBody(config, result),
      result
    )
    return conditionalResponse(h, result.etag, body).ifNoneMatch(
      request.headers['if-none-match']
    )
  }

  async function itemHandler(request, h) {
    await requireReadAccess(request, authenticationClient)
    const result = query.getItemById(
      config,
      request.params.id,
      request.query,
      getProjectionContext(request)
    )
    const body = postProcessItemBody(result.item, result)
    return conditionalResponse(h, result.etag, body).ifNoneMatch(
      request.headers['if-none-match']
    )
  }

  return { collectionHandler, itemHandler }
}
