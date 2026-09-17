// Shared write-authorisation helper reused by the upload-validation controller (Step 21)
// and the future atomic-replacement controller (Step 22). Mirrors `read-access.js`
// exactly, requiring `reference-data.write` instead of `reference-data.read`. Never
// calls the Authentication Service directly — always through the injected client.

import {
  requireAuthenticatedActor,
  requireWritePermission
} from '#/reference-data/validation/index.js'
import { extractBearerToken } from './read-access.js'

/**
 * Authenticates the request and requires the `reference-data.write` permission,
 * throwing the shared `unauthorized`/`forbidden` service errors on failure.
 * @returns {Promise<import('#/common/contracts/authentication-client.js').AuthenticatedActor>}
 */
export async function requireWriteAccess(request, authenticationClient) {
  const correlationId = request.app.correlationId
  const token = extractBearerToken(request.headers.authorization)
  const outcome = await authenticationClient.authenticate({
    token,
    correlationId
  })
  const actor = requireAuthenticatedActor(outcome)
  requireWritePermission(actor)
  return actor
}
