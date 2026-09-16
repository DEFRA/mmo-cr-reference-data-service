import { PERMISSIONS } from '#/common/contracts/authentication-client.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

export function hasExactPermission(actor, permission) {
  return (
    Array.isArray(actor?.permissions) && actor.permissions.includes(permission)
  )
}

function raiseAuthorisationError(code, message) {
  const error = new Error(message)
  error.code = code
  error.retryable = false
  throw error
}

/**
 * Requires a successful AuthenticationOutcome and returns its actor, or throws the
 * shared service-error model (`unauthorized`). Never returns or logs a raw token.
 */
export function requireAuthenticatedActor(outcome) {
  if (!outcome?.authenticated || !outcome.actor) {
    raiseAuthorisationError(
      SERVICE_ERROR_CODES.UNAUTHORIZED,
      outcome?.failure?.message ?? 'Authentication is required.'
    )
  }
  return outcome.actor
}

/**
 * Requires exact permission matching on an already-authenticated actor, or throws
 * the shared service-error model (`forbidden`). No substring or implicit matching.
 */
export function requirePermission(actor, permission) {
  if (!hasExactPermission(actor, permission)) {
    raiseAuthorisationError(
      SERVICE_ERROR_CODES.FORBIDDEN,
      `The actor does not hold the required permission: ${permission}.`
    )
  }
  return actor
}

export function requireReadPermission(actor) {
  return requirePermission(actor, PERMISSIONS.REFERENCE_DATA_READ)
}

export function requireWritePermission(actor) {
  return requirePermission(actor, PERMISSIONS.REFERENCE_DATA_WRITE)
}

// Pure, local check against an already-authenticated actor — never a second
// Authentication Service call.
export function authorize({ actor, permission } = {}) {
  return { authorised: hasExactPermission(actor, permission) }
}
