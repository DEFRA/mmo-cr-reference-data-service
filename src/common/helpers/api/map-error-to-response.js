import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import {
  HTTP_STATUS,
  getHttpStatusForErrorCode
} from '#/common/domain/http-status.js'
import { createErrorEnvelope } from './error-envelope.js'

function isKnownServiceError(error) {
  return (
    typeof error?.code === 'string' &&
    Object.values(SERVICE_ERROR_CODES).includes(error.code)
  )
}

function mapKnownServiceError(error, correlationId) {
  return {
    statusCode: getHttpStatusForErrorCode(error.code),
    envelope: createErrorEnvelope({
      code: error.code,
      message: error.message,
      traceId: correlationId,
      dataset: error.dataset ?? undefined,
      retryable: error.retryable,
      details: error.details
    })
  }
}

function extractJoiDetails(error) {
  if (!Array.isArray(error.details)) {
    return undefined
  }
  return error.details.map((detail) => ({
    path: Array.isArray(detail.path)
      ? detail.path.join('.')
      : String(detail.path ?? ''),
    message: detail.message
  }))
}

// Route-level request validation failures (Hapi decorates the Boom error with
// `.details` before calling failAction) are mapped to a stable, allowlisted shape
// rather than exposing raw Joi output.
function mapBoomError(error, correlationId) {
  const statusCode = error.output.statusCode
  const details = extractJoiDetails(error)

  if (details) {
    return {
      statusCode,
      envelope: createErrorEnvelope({
        code: 'invalid_request',
        message: 'The request contains validation errors.',
        traceId: correlationId,
        details
      })
    }
  }

  if (statusCode === HTTP_STATUS.NOT_FOUND) {
    return {
      statusCode,
      envelope: createErrorEnvelope({
        code: 'route_not_found',
        message: 'The requested resource was not found.',
        traceId: correlationId,
        retryable: false
      })
    }
  }

  if (statusCode === HTTP_STATUS.PAYLOAD_TOO_LARGE) {
    return {
      statusCode,
      envelope: createErrorEnvelope({
        code: 'payload_too_large',
        message: 'The request payload is too large.',
        traceId: correlationId,
        retryable: false
      })
    }
  }

  if (statusCode === HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE) {
    return {
      statusCode,
      envelope: createErrorEnvelope({
        code: 'unsupported_media_type',
        message: 'The request content type is not supported.',
        traceId: correlationId,
        retryable: false
      })
    }
  }

  if (statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return {
      statusCode,
      envelope: createErrorEnvelope({
        code: 'invalid_request',
        message: 'The request could not be processed.',
        traceId: correlationId,
        retryable: false
      })
    }
  }

  return mapUnexpectedError(correlationId)
}

function mapUnexpectedError(correlationId) {
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    envelope: createErrorEnvelope({
      code: 'internal_server_error',
      message: 'An unexpected error occurred.',
      traceId: correlationId,
      retryable: false
    })
  }
}

/**
 * Maps any error reaching the API boundary to `{ statusCode, envelope }` using a
 * fixed precedence: known domain/service-error codes first, then Hapi/Boom
 * (including route-validation failures), then a safe generic fallback. Never
 * exposes stack traces, raw Joi/Boom internals, or raw AWS SDK errors.
 */
export function mapErrorToResponse(error, { correlationId } = {}) {
  if (isKnownServiceError(error)) {
    return mapKnownServiceError(error, correlationId)
  }
  if (error?.isBoom) {
    return mapBoomError(error, correlationId)
  }
  return mapUnexpectedError(correlationId)
}
