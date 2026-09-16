import { describe, expect, test } from 'vitest'

import {
  SERVICE_ERROR_CODES,
  createServiceError,
  toPublicServiceError
} from './errors.js'

describe('#SERVICE_ERROR_CODES', () => {
  test('includes the agreed error codes', () => {
    expect(SERVICE_ERROR_CODES.INVALID_DATASET).toBe('invalid_dataset')
    expect(SERVICE_ERROR_CODES.SCHEMA_VALIDATION_FAILED).toBe(
      'schema_validation_failed'
    )
    expect(SERVICE_ERROR_CODES.INTERNAL_ERROR).toBe('internal_error')
  })

  test('is frozen', () => {
    expect(Object.isFrozen(SERVICE_ERROR_CODES)).toBe(true)
  })
})

describe('#createServiceError', () => {
  test('retains an internal diagnostic cause', () => {
    const cause = new Error('secret internal detail')
    const serviceError = createServiceError({
      code: SERVICE_ERROR_CODES.INTERNAL_ERROR,
      message: 'Something went wrong',
      cause
    })

    expect(serviceError.cause).toBe(cause)
  })
})

describe('#toPublicServiceError', () => {
  test('contains only safe public properties', () => {
    const serviceError = createServiceError({
      code: SERVICE_ERROR_CODES.DATASET_NOT_FOUND,
      message: 'Dataset not found',
      dataset: 'vessels',
      retryable: false,
      correlationId: 'abc-123',
      httpStatus: 404,
      cause: new Error('internal stack trace')
    })

    expect(toPublicServiceError(serviceError)).toEqual({
      code: SERVICE_ERROR_CODES.DATASET_NOT_FOUND,
      message: 'Dataset not found',
      dataset: 'vessels',
      details: null,
      retryable: false,
      correlationId: 'abc-123',
      httpStatus: 404
    })
  })

  test('excludes the internal diagnostic cause', () => {
    const serviceError = createServiceError({
      code: SERVICE_ERROR_CODES.INTERNAL_ERROR,
      message: 'Something went wrong',
      cause: new Error('internal stack trace with sensitive paths')
    })

    expect(toPublicServiceError(serviceError)).not.toHaveProperty('cause')
  })
})
