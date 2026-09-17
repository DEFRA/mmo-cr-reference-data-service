// Dedicated map-ports controller (Step 18). map-ports is a derived GeoJSON
// projection, not a generic JSON collection — deliberately not built on
// createCollectionRouteController's JSON envelope.

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'
import { matchesIfNoneMatch } from '#/common/helpers/api/conditional-request.js'
import { requireReadAccess } from './read-access.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_MODIFIED = 304
const GEO_JSON_CONTENT_TYPE = 'application/geo+json'

export function createMapPortsController({ query, authenticationClient }) {
  async function handler(request, h) {
    await requireReadAccess(request, authenticationClient)

    const { etag, body } = query.getMapPorts(request.query)
    const ifNoneMatch = request.headers['if-none-match']

    if (matchesIfNoneMatch(etag, ifNoneMatch)) {
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

  return { handler }
}
