import { describe, expect, test } from 'vitest'

import { getHttpStatusForErrorCode, HTTP_STATUS } from './http-status.js'

describe('#getHttpStatusForErrorCode', () => {
  test.each([
    ['invalid_request', HTTP_STATUS.BAD_REQUEST],
    ['unauthorized', HTTP_STATUS.UNAUTHORIZED],
    ['forbidden', HTTP_STATUS.FORBIDDEN],
    ['dataset_not_found', HTTP_STATUS.NOT_FOUND],
    ['collection_version_exists', HTTP_STATUS.CONFLICT],
    ['collection_modified', HTTP_STATUS.CONFLICT],
    ['file_too_large', HTTP_STATUS.PAYLOAD_TOO_LARGE],
    ['unsupported_media_type', HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE],
    ['schema_validation_failed', HTTP_STATUS.UNPROCESSABLE_ENTITY],
    ['authentication_service_unavailable', HTTP_STATUS.SERVICE_UNAVAILABLE],
    ['internal_error', HTTP_STATUS.INTERNAL_SERVER_ERROR]
  ])('maps %s to %i', (code, expected) => {
    expect(getHttpStatusForErrorCode(code)).toBe(expected)
  })

  test('falls back to 500 for an unrecognised code', () => {
    expect(getHttpStatusForErrorCode('not_a_real_code')).toBe(
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  })
})
