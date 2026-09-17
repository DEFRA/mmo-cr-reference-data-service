import { describe, expect, test } from 'vitest'

import { manifest } from './manifest.js'
import { MANIFEST_ROUTE_PATH } from '#/common/domain/route-paths.js'

describe('#manifestRouteRegistration', () => {
  test('registers the approved manifest route path and method', () => {
    expect(manifest.method).toBe('GET')
    expect(manifest.path).toBe(MANIFEST_ROUTE_PATH)
    expect(typeof manifest.handler).toBe('function')
  })
})
