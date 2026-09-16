import { describe, expect, test } from 'vitest'

import { mapS3Error, raisePersistenceError } from './error-mapping.js'

function createAwsError(name, statusCode) {
  const error = new Error(name)
  error.name = name
  error.$metadata = { httpStatusCode: statusCode }
  return error
}

describe('#mapS3Error', () => {
  test('NoSuchBucket maps to reference_store_unavailable', () => {
    const error = mapS3Error(createAwsError('NoSuchBucket', 404), {
      dataset: null
    })
    expect(error.code).toBe('reference_store_unavailable')
  })

  test('throttling responses map to a retryable reference_store_unavailable', () => {
    const error = mapS3Error(createAwsError('SlowDown', 503), { dataset: null })
    expect(error).toMatchObject({
      code: 'reference_store_unavailable',
      retryable: true
    })
  })

  test('a generic/unknown failure maps to a retryable reference_store_unavailable', () => {
    const error = mapS3Error(new Error('mystery failure'), { dataset: null })
    expect(error).toMatchObject({
      code: 'reference_store_unavailable',
      retryable: true
    })
  })

  test('the dataset context is attached', () => {
    const error = mapS3Error(createAwsError('AccessDenied', 403), {
      dataset: 'vessels'
    })
    expect(error.dataset).toBe('vessels')
  })

  test('the original cause is preserved for internal diagnostics only', () => {
    const cause = createAwsError('AccessDenied', 403)
    const error = mapS3Error(cause, {})
    expect(error.cause).toBe(cause)
  })
})

describe('#raisePersistenceError', () => {
  test('throws an Error carrying the service-error fields', () => {
    expect(() =>
      raisePersistenceError('invalid_request', 'boom', 'vessels')
    ).toThrow('boom')
    try {
      raisePersistenceError('invalid_request', 'boom', 'vessels')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'invalid_request',
        dataset: 'vessels',
        retryable: false
      })
    }
  })
})
