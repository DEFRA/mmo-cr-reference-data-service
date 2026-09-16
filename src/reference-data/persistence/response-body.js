// Safe S3 response-body handling: never evaluates content as code, distinguishes a missing
// body from malformed JSON, and never returns raw strings where parsed data is expected.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'
import { raisePersistenceError } from './error-mapping.js'
import { calculateChecksum } from './checksum.js'

/**
 * @param {import('@aws-sdk/client-s3').GetObjectCommandOutput} response
 * @param {string} dataset used only for error context, not returned to callers
 */
export async function readJsonBody(response, dataset) {
  if (!response?.Body) {
    return raisePersistenceError(
      SERVICE_ERROR_CODES.REFERENCE_DATA_UNAVAILABLE,
      'Reference-data object has no readable body',
      dataset
    )
  }

  const text = await response.Body.transformToString('utf-8')

  try {
    return { data: JSON.parse(text), checksum: calculateChecksum(text) }
  } catch (cause) {
    return raisePersistenceError(
      SERVICE_ERROR_CODES.INVALID_JSON,
      'Stored reference-data object is not valid JSON',
      dataset,
      cause
    )
  }
}
