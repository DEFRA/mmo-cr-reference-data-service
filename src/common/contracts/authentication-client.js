// Infrastructure-independent interface owned by the future Validation Module for
// Authentication Service integration. No HTTP-client types or raw bearer tokens are exposed here.

export const PERMISSIONS = Object.freeze({
  REFERENCE_DATA_READ: 'reference-data.read',
  REFERENCE_DATA_WRITE: 'reference-data.write'
})

/**
 * @typedef {Object} AuthenticatedActor
 * @property {string} actorId
 * @property {string[]} permissions one or more PERMISSIONS values
 *
 * @typedef {Object} AuthenticationFailure
 * @property {string} code
 * @property {string} message safe public message
 *
 * @typedef {Object} AuthenticationOutcome
 * @property {boolean} authenticated
 * @property {AuthenticatedActor} [actor]
 * @property {AuthenticationFailure} [failure]
 * @property {string} [correlationId]
 *
 * @typedef {Object} AuthorisationOutcome
 * @property {boolean} authorised
 * @property {string} [correlationId]
 */

function notImplemented(methodName) {
  return () => {
    throw new Error(`authenticationClient.${methodName} is not implemented`)
  }
}

/**
 * @param {Object} [overrides] test-double or adapter implementations for individual methods
 */
export function createAuthenticationClientContract(overrides = {}) {
  return {
    authenticate: notImplemented('authenticate'),
    authorize: notImplemented('authorize'),
    ...overrides
  }
}
