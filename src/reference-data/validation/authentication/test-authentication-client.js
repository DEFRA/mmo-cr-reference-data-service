import { createAuthenticationClientContract } from '#/common/contracts/authentication-client.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

/**
 * Controlled test double for local/dev and unit tests. Never selected implicitly:
 * production always composes createHttpAuthenticationClient (see validation/index.js).
 * Uses only synthetic actor identifiers supplied explicitly by the caller.
 */
export function createTestAuthenticationClient({ tokens = {} } = {}) {
  async function authenticate({ token, correlationId } = {}) {
    if (!token) {
      return {
        authenticated: false,
        failure: {
          code: SERVICE_ERROR_CODES.UNAUTHORIZED,
          message: 'A bearer token is required.'
        },
        correlationId
      }
    }

    const outcome = tokens[token]
    if (!outcome) {
      return {
        authenticated: false,
        failure: {
          code: SERVICE_ERROR_CODES.UNAUTHORIZED,
          message: 'The supplied test token is not recognised.'
        },
        correlationId
      }
    }

    if (outcome.unavailable) {
      return {
        authenticated: false,
        failure: {
          code: SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
          message: 'Simulated Authentication Service unavailability.'
        },
        correlationId
      }
    }

    return {
      authenticated: true,
      actor: {
        actorId: outcome.actorId,
        permissions: outcome.permissions ?? []
      },
      correlationId
    }
  }

  return createAuthenticationClientContract({ authenticate })
}
