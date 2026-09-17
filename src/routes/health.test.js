import { describe, expect, test } from 'vitest'

import { health } from './health.js'
import { createFakeToolkit } from './route-test-helpers.js'

describe('#healthRoute', () => {
  test('is registered as GET /health', () => {
    expect(health.method).toBe('GET')
    expect(health.path).toBe('/health')
  })

  test('returns a safe liveness payload with a 200 status', () => {
    const { h, calls } = createFakeToolkit()
    health.handler({}, h)

    expect(calls.statusCode).toBe(200)
    expect(calls.payload).toEqual({
      status: 'ok',
      service: 'mmo-cr-reference-data-service',
      timestamp: expect.any(String)
    })
    expect(() => new Date(calls.payload.timestamp).toISOString()).not.toThrow()
  })

  test('returns Cache-Control: no-store', () => {
    const { h, calls } = createFakeToolkit()
    health.handler({}, h)

    expect(calls.headers['Cache-Control']).toBe('no-store')
  })

  test('exposes only the approved fields', () => {
    const { h, calls } = createFakeToolkit()
    health.handler({}, h)

    expect(Object.keys(calls.payload).sort()).toEqual([
      'service',
      'status',
      'timestamp'
    ])
  })
})
