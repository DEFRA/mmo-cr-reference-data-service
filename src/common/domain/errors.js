// Central service-level error codes and safe public serialisation.

export const SERVICE_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  INVALID_DATASET: 'invalid_dataset',
  INVALID_JSON: 'invalid_json',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  DATASET_NOT_FOUND: 'dataset_not_found',
  REFERENCE_ITEM_NOT_FOUND: 'reference_item_not_found',
  MAP_LAYER_NOT_FOUND: 'map_layer_not_found',
  COLLECTION_VERSION_EXISTS: 'collection_version_exists',
  COLLECTION_MODIFIED: 'collection_modified',
  DUPLICATE_IDENTIFIER: 'duplicate_identifier',
  DUPLICATE_BUSINESS_CODE: 'duplicate_business_code',
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type',
  SCHEMA_VALIDATION_FAILED: 'schema_validation_failed',
  BUSINESS_VALIDATION_FAILED: 'business_validation_failed',
  AUTHENTICATION_SERVICE_UNAVAILABLE: 'authentication_service_unavailable',
  REFERENCE_STORE_UNAVAILABLE: 'reference_store_unavailable',
  REFERENCE_DATA_UNAVAILABLE: 'reference_data_unavailable',
  INTERNAL_ERROR: 'internal_error'
})

/**
 * @typedef {Object} ServiceError
 * @property {string} code one of SERVICE_ERROR_CODES
 * @property {string} message safe public message
 * @property {string} [dataset] one of the DATASETS identifiers, where applicable
 * @property {*} [details] structured, public-safe details
 * @property {boolean} retryable
 * @property {string} [correlationId]
 * @property {number} [httpStatus] recommended HTTP status
 * @property {*} [cause] internal diagnostic cause, excluded from public serialisation
 */

/**
 * @param {Object} input
 * @returns {ServiceError}
 */
export function createServiceError({
  code,
  message,
  dataset = null,
  details = null,
  retryable = false,
  correlationId = null,
  httpStatus = null,
  cause = null
}) {
  return {
    code,
    message,
    dataset,
    details,
    retryable,
    correlationId,
    httpStatus,
    cause
  }
}

/**
 * Strips internal diagnostic information before a ServiceError is exposed publicly.
 * @param {ServiceError} serviceError
 */
export function toPublicServiceError(serviceError) {
  const {
    code,
    message,
    dataset,
    details,
    retryable,
    correlationId,
    httpStatus
  } = serviceError

  return {
    code,
    message,
    dataset,
    details,
    retryable,
    correlationId,
    httpStatus
  }
}
