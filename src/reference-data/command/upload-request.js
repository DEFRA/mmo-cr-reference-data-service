// Framework-agnostic upload-request helpers for the Command Module's validation-only
// use case (Step 21). Operates on the already-parsed Hapi multipart payload shape
// (`{ filename, headers, payload }` per file part — see the Step 21 plan for the
// empirically-verified Hapi behaviour this relies on). Never touches Hapi request/
// response objects, S3, Floci, the Authentication Service, or the in-memory store.

import {
  getDatasetCapabilities,
  DATASET_FORMAT
} from '#/common/domain/datasets.js'
import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const MAX_DESCRIPTION_LENGTH = 500

const EXPECTED_CONTENT_TYPE = Object.freeze({
  [DATASET_FORMAT.JSON]: 'application/json',
  [DATASET_FORMAT.GEOJSON]: 'application/geo+json'
})

function raise(code, message, details = null) {
  const error = new Error(message)
  error.code = code
  error.retryable = false
  if (details) {
    error.details = details
  }
  throw error
}

function isUploadedFilePart(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'payload' in value
  )
}

function isUsableCollection(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isEmptyCollection(value) {
  return isUsableCollection(value) && Object.keys(value).length === 0
}

function normaliseContentType(contentType) {
  return typeof contentType === 'string'
    ? contentType.split(';')[0].trim().toLowerCase()
    : null
}

/**
 * Extracts exactly one uploaded file part from an already-parsed multipart payload,
 * rejecting a missing or multiple-files request.
 */
export function extractSingleUploadedFile(payload) {
  const file = payload?.file

  if (Array.isArray(file)) {
    raise(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      'Exactly one file may be uploaded.'
    )
  }

  if (!isUploadedFilePart(file)) {
    raise(SERVICE_ERROR_CODES.INVALID_REQUEST, 'A collection file is required.')
  }

  return {
    contentType: normaliseContentType(file.headers?.['content-type']),
    payload: file.payload
  }
}

/**
 * Validates the uploaded file's declared media type against the dataset's expected
 * format and returns the parsed collection content. Never mutates the file payload.
 */
export function parseUploadedFileContent({ dataset, file }) {
  const expectedContentType =
    EXPECTED_CONTENT_TYPE[getDatasetCapabilities(dataset).format]

  if (file.contentType !== expectedContentType) {
    raise(
      SERVICE_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      `Expected file content type "${expectedContentType}" for dataset "${dataset}".`
    )
  }

  if (Buffer.isBuffer(file.payload)) {
    raise(
      SERVICE_ERROR_CODES.INVALID_JSON,
      'The uploaded file is not valid JSON.'
    )
  }

  if (isEmptyCollection(file.payload)) {
    raise(SERVICE_ERROR_CODES.INVALID_REQUEST, 'The uploaded file is empty.')
  }

  return file.payload
}

function checkFieldConflict(fieldName, fieldValue, envelopeValue) {
  if (
    fieldValue !== undefined &&
    envelopeValue !== undefined &&
    fieldValue !== envelopeValue
  ) {
    raise(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      `Supplied "${fieldName}" ("${fieldValue}") does not match the collection's declared "${fieldName}" ("${envelopeValue}").`
    )
  }
}

function isValidIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

/**
 * Resolves and cross-checks upload metadata fields against the collection envelope.
 * Never mutates `collection`.
 */
export function resolveUploadMetadata({ fields = {}, collection } = {}) {
  const { schemaVersion, version, effectiveFrom, description } = fields
  const envelope = isUsableCollection(collection) ? collection : {}

  checkFieldConflict('schemaVersion', schemaVersion, envelope.schemaVersion)
  checkFieldConflict('version', version, envelope.version)

  if (effectiveFrom !== undefined && !isValidIsoDate(effectiveFrom)) {
    raise(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      '"effectiveFrom" must be a valid ISO-8601 timestamp.'
    )
  }

  if (
    typeof description === 'string' &&
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    raise(
      SERVICE_ERROR_CODES.INVALID_REQUEST,
      `"description" must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`
    )
  }

  return {
    schemaVersion: schemaVersion ?? envelope.schemaVersion,
    version: version ?? envelope.version,
    effectiveFrom: effectiveFrom ?? envelope.effectiveFrom,
    description
  }
}
