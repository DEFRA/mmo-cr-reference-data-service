import { createAuthenticationClientContract } from '#/common/contracts/authentication-client.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const DEFAULT_VALIDATE_PATH = '/validate'
const HTTP_STATUS_UNAUTHORIZED = 401
const HTTP_STATUS_FORBIDDEN = 403
const RETRYABLE_STATUSES = new Set([502, 503, 504])

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
  async function attemptOnce({ token, correlationId }) {
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

  async function authenticate({ token, correlationId } = {}) {
    if (!token) {
      return toFailure(
        SERVICE_ERROR_CODES.UNAUTHORIZED,
        'A bearer token is required.',
        correlationId
      )
    }
    if (!baseUrl) {
      return toFailure(
        SERVICE_ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
        'Authentication Service is not configured.',
        correlationId
      )
    }

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        return await attemptOnce({ token, correlationId })
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

  return createAuthenticationClientContract({ authenticate })
}
