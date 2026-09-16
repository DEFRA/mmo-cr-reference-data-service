import { describe, expect, test } from 'vitest'

import { mapErrorToResponse } from './map-error-to-response.js'

describe('#mapErrorToResponse known domain errors', () => {
  test('maps unauthorized to 401', () => {
    const result = mapErrorToResponse(
      { code: 'unauthorized', message: 'x' },
      { correlationId: 'c1' }
    )
    expect(result.statusCode).toBe(401)
    expect(result.envelope.error).toEqual({
      code: 'unauthorized',
      message: 'x',
      traceId: 'c1'
    })
  })

  test('maps forbidden to 403', () => {
    expect(
      mapErrorToResponse({ code: 'forbidden', message: 'x' }).statusCode
    ).toBe(403)
  })

  test('maps dataset_not_found to 404', () => {
    expect(
      mapErrorToResponse({ code: 'dataset_not_found', message: 'x' }).statusCode
    ).toBe(404)
  })

  test('maps collection_version_exists to 409', () => {
    expect(
      mapErrorToResponse({ code: 'collection_version_exists', message: 'x' })
        .statusCode
    ).toBe(409)
  })

  test('maps collection_modified (stale If-Match) to 409', () => {
    expect(
      mapErrorToResponse({ code: 'collection_modified', message: 'x' })
        .statusCode
    ).toBe(409)
  })

  test('maps file_too_large to 413', () => {
    expect(
      mapErrorToResponse({ code: 'file_too_large', message: 'x' }).statusCode
    ).toBe(413)
  })

  test('maps unsupported_media_type to 415', () => {
    expect(
      mapErrorToResponse({ code: 'unsupported_media_type', message: 'x' })
        .statusCode
    ).toBe(415)
  })

  test('maps schema_validation_failed and business_validation_failed to 422', () => {
    expect(
      mapErrorToResponse({ code: 'schema_validation_failed', message: 'x' })
        .statusCode
    ).toBe(422)
    expect(
      mapErrorToResponse({ code: 'business_validation_failed', message: 'x' })
        .statusCode
    ).toBe(422)
  })

  test('maps authentication_service_unavailable and reference_data_unavailable to 503', () => {
    expect(
      mapErrorToResponse({
        code: 'authentication_service_unavailable',
        message: 'x'
      }).statusCode
    ).toBe(503)
    expect(
      mapErrorToResponse({ code: 'reference_data_unavailable', message: 'x' })
        .statusCode
    ).toBe(503)
  })

  test('maps internal_error to 500', () => {
    expect(
      mapErrorToResponse({ code: 'internal_error', message: 'x' }).statusCode
    ).toBe(500)
  })

  test('includes dataset and retryable only when present', () => {
    const result = mapErrorToResponse({
      code: 'dataset_not_found',
      message: 'x',
      dataset: 'ports',
      retryable: true
    })
    expect(result.envelope.error.dataset).toBe('ports')
    expect(result.envelope.error.retryable).toBe(true)
  })

  test('omits dataset and retryable when undefined', () => {
    const result = mapErrorToResponse({ code: 'internal_error', message: 'x' })
    expect(result.envelope.error).not.toHaveProperty('dataset')
    expect(result.envelope.error).not.toHaveProperty('retryable')
  })

  test('a known service error is checked before generic Boom status metadata', () => {
    // Simulates Hapi boomifying a thrown domain error: isBoom is added, but the
    // original .code custom property survives on the same object.
    const boomifiedDomainError = {
      isBoom: true,
      code: 'reference_store_unavailable',
      message: 'bucket missing',
      output: { statusCode: 404 }
    }
    const result = mapErrorToResponse(boomifiedDomainError)
    // Must resolve via the specific code (503), NOT the generic Boom 404 branch.
    expect(result.statusCode).toBe(503)
    expect(result.envelope.error.code).toBe('reference_store_unavailable')
  })

  test('does not expose an internal cause', () => {
    const result = mapErrorToResponse({
      code: 'internal_error',
      message: 'x',
      cause: new Error('secret internal detail')
    })
    expect(JSON.stringify(result.envelope)).not.toContain(
      'secret internal detail'
    )
  })
})

describe('#mapErrorToResponse Boom/validation errors', () => {
  test('maps a route validation failure (Boom with Joi details) to 400 invalid_request', () => {
    const boomValidationError = {
      isBoom: true,
      output: { statusCode: 400 },
      details: [
        { path: ['items', 0, 'id'], message: '"id" must be a valid GUID' }
      ]
    }
    const result = mapErrorToResponse(boomValidationError, {
      correlationId: 'c2'
    })
    expect(result.statusCode).toBe(400)
    expect(result.envelope.error.code).toBe('invalid_request')
    expect(result.envelope.error.details).toEqual([
      { path: 'items.0.id', message: '"id" must be a valid GUID' }
    ])
  })

  test('maps an unmatched route (plain Boom 404, no details) to route_not_found', () => {
    const boomNotFound = { isBoom: true, output: { statusCode: 404 } }
    const result = mapErrorToResponse(boomNotFound, { correlationId: 'c3' })
    expect(result.statusCode).toBe(404)
    expect(result.envelope.error).toEqual({
      code: 'route_not_found',
      message: 'The requested resource was not found.',
      traceId: 'c3',
      retryable: false
    })
  })

  test('maps a 413 Boom to payload_too_large', () => {
    const boom413 = { isBoom: true, output: { statusCode: 413 } }
    expect(mapErrorToResponse(boom413).envelope.error.code).toBe(
      'payload_too_large'
    )
  })

  test('maps a 415 Boom to unsupported_media_type', () => {
    const boom415 = { isBoom: true, output: { statusCode: 415 } }
    expect(mapErrorToResponse(boom415).envelope.error.code).toBe(
      'unsupported_media_type'
    )
  })

  test('an unknown 4xx Boom without details becomes a safe invalid_request', () => {
    const boom400 = { isBoom: true, output: { statusCode: 400 } }
    const result = mapErrorToResponse(boom400)
    expect(result.statusCode).toBe(400)
    expect(result.envelope.error.code).toBe('invalid_request')
  })

  test('an unknown 5xx Boom becomes a safe 500 with no internal detail', () => {
    const boom502 = {
      isBoom: true,
      output: { statusCode: 502 },
      message: 'internal detail'
    }
    const result = mapErrorToResponse(boom502)
    expect(result.statusCode).toBe(500)
    expect(result.envelope.error.code).toBe('internal_server_error')
    expect(JSON.stringify(result.envelope)).not.toContain('internal detail')
  })
})

describe('#mapErrorToResponse unexpected errors', () => {
  test('an unrecognised plain Error becomes a safe 500', () => {
    const result = mapErrorToResponse(new Error('boom'), {
      correlationId: 'c4'
    })
    expect(result.statusCode).toBe(500)
    expect(result.envelope.error).toEqual({
      code: 'internal_server_error',
      message: 'An unexpected error occurred.',
      traceId: 'c4',
      retryable: false
    })
  })

  test('never includes a stack trace', () => {
    const result = mapErrorToResponse(new Error('boom'))
    expect(JSON.stringify(result.envelope)).not.toContain('at ')
  })
})
