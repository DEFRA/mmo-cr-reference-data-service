import { describe, expect, test } from 'vitest'

import { uploadValidation } from './upload-validation.js'
import { UPLOAD_ROUTE_PATH } from '#/common/domain/route-paths.js'

describe('#uploadValidationRouteRegistration', () => {
  test('registers the approved upload-validation route path and method', () => {
    expect(uploadValidation.method).toBe('PUT')
    expect(uploadValidation.path).toBe(UPLOAD_ROUTE_PATH)
    expect(typeof uploadValidation.handler).toBe('function')
  })
})
