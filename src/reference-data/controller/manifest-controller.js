// Manifest API controller (Step 14). Owns Hapi request/response mapping only;
// reads active state through the injected Query Module and authenticates/
// authorises through the injected Validation Module client — never S3, never
// Floci, never a second Authentication Service call path.

import { CACHE_CONTROL } from '#/common/helpers/api/cache-control.js'
import { matchesIfNoneMatch } from '#/common/helpers/api/conditional-request.js'
import { requireReadAccess } from './read-access.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_MODIFIED = 304

/**
 * @param {{ query: { getManifest: Function }, authenticationClient: import('#/common/contracts/authentication-client.js').AuthenticationClient }} deps
 */
export function createManifestController({ query, authenticationClient }) {
  async function handler(request, h) {
    await requireReadAccess(request, authenticationClient)

    const { etag, body } = query.getManifest({ include: request.query.include })
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
      .header('ETag', etag)
      .header('Cache-Control', CACHE_CONTROL.REFERENCE_DATA_READ)
  }

  return { handler }
}
