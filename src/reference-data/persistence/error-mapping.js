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
const NOT_FOUND_NAMES = new Set(['NoSuchKey', 'NotFound'])
const INVALID_CREDENTIAL_NAMES = new Set([
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'UnrecognizedClientException'
])
const THROTTLING_NAMES = new Set(['SlowDown', 'ThrottlingException'])
const TIMEOUT_SYSTEM_CODES = new Set(['ETIMEDOUT'])
const UNREACHABLE_SYSTEM_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND'])

const HTTP_STATUS_NOT_FOUND = 404
const HTTP_STATUS_FORBIDDEN = 403
const HTTP_STATUS_PRECONDITION_FAILED = 412
const HTTP_STATUS_TOO_MANY_REQUESTS = 429
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503
const THROTTLING_STATUS_CODES = new Set([
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_MANY_REQUESTS
])

const DEFAULT_ERROR_RESULT = {
  code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
  message: 'Reference-data storage is unavailable',
  retryable: true
}

// Ordered, data-driven rules keep each predicate trivial rather than one long conditional chain.
const ERROR_RULES = [
  {
    matches: ({ name }) => name === 'NoSuchBucket',
    result: {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Configured reference-data bucket does not exist'
    }
  },
  {
    matches: ({ name, httpStatus }) =>
      NOT_FOUND_NAMES.has(name) || httpStatus === HTTP_STATUS_NOT_FOUND,
    result: {
      code: SERVICE_ERROR_CODES.DATASET_NOT_FOUND,
      message: 'Reference-data object not found'
    }
  },
  {
    matches: ({ name, httpStatus }) =>
      name === 'AccessDenied' || httpStatus === HTTP_STATUS_FORBIDDEN,
    result: {
      code: SERVICE_ERROR_CODES.FORBIDDEN,
      message: 'Access to reference-data storage was denied'
    }
  },
  {
    matches: ({ name, httpStatus }) =>
      name === 'PreconditionFailed' ||
      httpStatus === HTTP_STATUS_PRECONDITION_FAILED,
    result: {
      code: SERVICE_ERROR_CODES.COLLECTION_MODIFIED,
      message: 'Reference-data object was modified concurrently'
    }
  },
  {
    matches: ({ name }) => INVALID_CREDENTIAL_NAMES.has(name),
    result: {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage credentials are invalid'
    }
  },
  {
    matches: ({ name, httpStatus }) =>
      THROTTLING_NAMES.has(name) || THROTTLING_STATUS_CODES.has(httpStatus),
    result: {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage is throttling requests',
      retryable: true
    }
  },
  {
    matches: ({ name, systemCode }) =>
      name === 'TimeoutError' || TIMEOUT_SYSTEM_CODES.has(systemCode),
    result: {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage timed out',
      retryable: true
    }
  },
  {
    matches: ({ name, systemCode }) =>
      UNREACHABLE_SYSTEM_CODES.has(systemCode) || name === 'UnknownEndpoint',
    result: {
      code: SERVICE_ERROR_CODES.REFERENCE_STORE_UNAVAILABLE,
      message: 'Reference-data storage endpoint is unreachable',
      retryable: true
    }
  }
]

function mapKnownError(error) {
  const context = {
    name: error?.name,
    systemCode: error?.code,
    httpStatus: error?.$metadata?.httpStatusCode
  }
  const rule = ERROR_RULES.find((candidate) => candidate.matches(context))
  return rule ? rule.result : DEFAULT_ERROR_RESULT
}

/**
 * @param {unknown} cause the original AWS SDK or system error (preserved only as an internal, non-public cause)
 * @param {{ dataset?: string }} [context]
 */
export function mapS3Error(cause, { dataset } = {}) {
  const { code, message, retryable = false } = mapKnownError(cause)
  const error = new Error(message)
  error.code = code
  error.dataset = dataset ?? null
  error.cause = cause
  error.isServiceError = true
  return withRetryable(error, retryable)
}
