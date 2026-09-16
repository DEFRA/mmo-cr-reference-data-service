// Translates AWS SDK v3 / infrastructure errors into the Step 03 service-error model.
// No AWS SDK response objects, credentials, or stack traces are exposed through thrown errors.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

export function raisePersistenceError(code, message, dataset, cause) {
  const error = new Error(message)
  error.code = code
  error.dataset = dataset ?? null
  error.retryable = false
  error.isServiceError = true
  if (cause) {
    error.cause = cause
  }
  throw error
}

function withRetryable(error, retryable) {
  error.retryable = retryable
  return error
}

// Node system errors (connection failures) surface as `error.code`; AWS SDK service errors use `error.name`.
function mapKnownError(error, { dataset }) {
  const name = error?.name
  const systemCode = error?.code
  const httpStatus = error?.$metadata?.httpStatusCode

  if (name === 'NoSuchBucket') {
    return {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Configured reference-data bucket does not exist'
    }
  }
  if (name === 'NoSuchKey' || name === 'NotFound' || httpStatus === 404) {
    return {
      code: SERVICE_ERROR_CODES.DATASET_NOT_FOUND,
      message: 'Reference-data object not found'
    }
  }
  if (name === 'AccessDenied' || httpStatus === 403) {
    return {
      code: SERVICE_ERROR_CODES.FORBIDDEN,
      message: 'Access to reference-data storage was denied'
    }
  }
  if (name === 'PreconditionFailed' || httpStatus === 412) {
    return {
      code: SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
      message: 'Reference-data object was modified concurrently'
    }
  }
  if (
    name === 'InvalidAccessKeyId' ||
    name === 'SignatureDoesNotMatch' ||
    name === 'UnrecognizedClientException'
  ) {
    return {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage credentials are invalid'
    }
  }
  if (
    name === 'SlowDown' ||
    name === 'ThrottlingException' ||
    httpStatus === 503 ||
    httpStatus === 429
  ) {
    return {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage is throttling requests',
      retryable: true
    }
  }
  if (name === 'TimeoutError' || systemCode === 'ETIMEDOUT') {
    return {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage timed out',
      retryable: true
    }
  }
  if (
    systemCode === 'ECONNREFUSED' ||
    systemCode === 'ENOTFOUND' ||
    name === 'UnknownEndpoint'
  ) {
    return {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage endpoint is unreachable',
      retryable: true
    }
  }

  return {
    code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
    message: 'Reference-data storage is unavailable',
    retryable: true
  }
}

/**
 * @param {unknown} cause the original AWS SDK or system error (preserved only as an internal, non-public cause)
 * @param {{ dataset?: string }} [context]
 */
export function mapS3Error(cause, { dataset } = {}) {
  const { code, message, retryable = false } = mapKnownError(cause, { dataset })
  const error = new Error(message)
  error.code = code
  error.dataset = dataset ?? null
  error.cause = cause
  error.isServiceError = true
  return withRetryable(error, retryable)
}
