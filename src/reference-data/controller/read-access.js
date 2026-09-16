// Shared read-authorisation helper reused by every reference-data controller
// (Step 14 manifest controller, Steps 16-20 dataset controllers). Never calls the
// Authentication Service directly — always through the injected client.

import {
  requireAuthenticatedActor,
  requireReadPermission
} from '#/reference-data/validation/index.js'

const BEARER_PREFIX = 'Bearer '

export function extractBearerToken(authorizationHeader) {
  if (
    typeof authorizationHeader !== 'string' ||
    !authorizationHeader.startsWith(BEARER_PREFIX)
  ) {
    return null
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Authenticates the request and requires the `reference-data.read` permission,
 * throwing the shared `unauthorized`/`forbidden` service errors on failure.
 * @returns {Promise<import('#/common/contracts/authentication-client.js').AuthenticatedActor>}
 */
export async function requireReadAccess(request, authenticationClient) {
  const correlationId = request.app.correlationId
  const token = extractBearerToken(request.headers.authorization)
  const outcome = await authenticationClient.authenticate({
    token,
    correlationId
  })
  const actor = requireAuthenticatedActor(outcome)
  requireReadPermission(actor)
  return actor
}
