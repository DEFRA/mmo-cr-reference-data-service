// Step 19: Accept-Language parsing (owner-approved, 2026-09-16). Only the first
// syntactically valid tag is selected — quality weights and regional fallback are
// deliberately not implemented; this is not a claim of full RFC 4647/7231 support.

import { SERVICE_ERROR_CODES } from '#/common/domain/errors.js'

const MAX_HEADER_LENGTH = 200
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/

function raiseInvalid(message) {
  const error = new Error(message)
  error.code = SERVICE_ERROR_CODES.INVALID_REQUEST
  error.retryable = false
  throw error
}

/**
 * @param {string|undefined} headerValue raw `Accept-Language` header
 * @returns {string|null} the first valid language tag, or `null` when the header is
 *   absent. Never exposes the complete raw header in its error message.
 */
export function parseAcceptLanguageTag(headerValue) {
  if (headerValue === undefined) {
    return null
  }
  if (
    typeof headerValue !== 'string' ||
    headerValue.length > MAX_HEADER_LENGTH
  ) {
    raiseInvalid('Accept-Language header is malformed or too long')
  }

  const firstEntry = headerValue.split(',')[0]
  const tag = firstEntry.split(';')[0].trim()

  if (!LANGUAGE_TAG_PATTERN.test(tag)) {
    raiseInvalid('Accept-Language header contains no valid language tag')
  }

  return tag
}
