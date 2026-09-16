import { createAuthenticationClientContract } from '#/common/contracts/authentication-client.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const DEFAULT_VALIDATE_PATH = '/validate'
const HTTP_STATUS_UNAUTHORIZED = 401
const HTTP_STATUS_FORBIDDEN = 403
const HTTP_STATUS_BAD_GATEWAY = 502
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503
const HTTP_STATUS_GATEWAY_TIMEOUT = 504
const RETRYABLE_STATUSES = new Set([
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_GATEWAY_TIMEOUT
])

function toFailure(code, message, correlationId) {
  return { authenticated: false, failure: { code, message }, correlationId }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Accepts only the exact PROVISIONAL success shape ({ actorId: string, permissions:
// string[] }); anything else fails closed rather than partially trusting the body.
function mapSuccessBody(body) {
  if (
    !body ||
    typeof body.actorId !== 'string' ||
    !Array.isArray(body.permissions) ||
    !body.permissions.every((permission) => typeof permission === 'string')
  ) {
    return null
  }
  return { actorId: body.actorId, permissions: body.permissions }
}

async function sendValidateRequest({
  baseUrl,
  path,
  token,
  correlationId,
  timeoutMs,
  fetchFn,
  tracingHeader
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(correlationId ? { [tracingHeader]: correlationId } : {})
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

async function attemptAuthenticate(options, { token, correlationId }) {
  const { baseUrl, path, timeoutMs, fetchFn, tracingHeader } = options
  const response = await sendValidateRequest({
    baseUrl,
    path,
    token,
    correlationId,
    timeoutMs,
    fetchFn,
    tracingHeader
  })

  if (response.status === HTTP_STATUS_UNAUTHORIZED) {
    return toFailure(
      SERVICE_ERROR_CODES.UNAUTHORIZED,
      'The supplied token is invalid or expired.',
      correlationId
    )
  }
  if (response.status === HTTP_STATUS_FORBIDDEN) {
    return toFailure(
      SERVICE_ERROR_CODES.FORBIDDEN,
      'The supplied token is not authorised.',
      correlationId
    )
  }
  if (!response.ok) {
    const error = new Error(
      `Authentication Service responded with status ${response.status}`
    )
    error.retryableStatus = RETRYABLE_STATUSES.has(response.status)
    throw error
  }

  const actor = mapSuccessBody(await response.json())
  if (!actor) {
    return toFailure(
      SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
      'Authentication Service returned a malformed response.',
      correlationId
    )
  }

  return { authenticated: true, actor, correlationId }
}

// Guards checked before any network attempt; returns a failure outcome, or null
// when it is safe to proceed to attemptAuthenticate.
function guardAuthenticateInput(options, { token, correlationId }) {
  if (!token) {
    return toFailure(
      SERVICE_ERROR_CODES.UNAUTHORIZED,
      'A bearer token is required.',
      correlationId
    )
  }
  if (!options.baseUrl) {
    return toFailure(
      SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
      'Authentication Service is not configured.',
      correlationId
    )
  }
  return null
}

async function authenticateWithRetry(options, { token, correlationId }) {
  const { retryCount, retryDelayMs } = options

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await attemptAuthenticate(options, { token, correlationId })
    } catch (cause) {
      const isLastAttempt = attempt === retryCount
      if (isLastAttempt || cause.retryableStatus === false) {
        return toFailure(
          SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
          'Authentication Service is unavailable.',
          correlationId
        )
      }
      await sleep(retryDelayMs)
    }
  }

  return toFailure(
    SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
    'Authentication Service is unavailable.',
    correlationId
  )
}

/**
 * PROVISIONAL Authentication Service HTTP client (Step 12). No real Authentication
 * Service contract has been confirmed anywhere in this repository or its design
 * docs. This assumes, until told otherwise, `POST {baseUrl}{path}` with a bearer
 * token, returning `{ actorId, permissions[] }` on success. Every request/response
 * shape here is provisional and must be revisited once the real contract is known.
 * Constructing this client performs no network call.
 */
export function createHttpAuthenticationClient({
  baseUrl,
  path = DEFAULT_VALIDATE_PATH,
  timeoutMs,
  retryCount = 0,
  retryDelayMs = 0,
  tracingHeader = 'x-cdp-request-id',
  fetchFn = fetch
} = {}) {
  const options = {
    baseUrl,
    path,
    timeoutMs,
    retryCount,
    retryDelayMs,
    tracingHeader,
    fetchFn
  }

  async function authenticate({ token, correlationId } = {}) {
    const guardFailure = guardAuthenticateInput(options, {
      token,
      correlationId
    })
    if (guardFailure) {
      return guardFailure
    }
    return authenticateWithRetry(options, { token, correlationId })
  }

  return createAuthenticationClientContract({ authenticate })
}
