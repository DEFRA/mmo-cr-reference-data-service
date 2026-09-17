import { describe, expect, test, vi } from 'vitest'

vi.mock('#/common/helpers/observability/metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordCounter: vi.fn(), recordDuration: vi.fn() }
})

import { metricsHttp } from './metrics-http.js'
import {
  recordCounter,
  recordDuration
} from '#/common/helpers/observability/metrics.js'

function createFakeServer() {
  const extensions = {}
  return {
    ext: (event, handler) => {
      extensions[event] = handler
    },
    trigger: (event, request, h) => extensions[event](request, h)
  }
}

describe('#metricsHttp plugin', () => {
  test('records a request counter and duration with bounded labels', async () => {
    const server = createFakeServer()
    metricsHttp.plugin.register(server)

    const request = {
      route: { path: '/api/v1/reference-data/vessels/{id}' },
      method: 'get',
      info: { received: Date.now() - 42 },
      response: { isBoom: false, statusCode: 200 }
    }
    const h = { continue: 'continue-symbol' }

    const result = await server.trigger('onPreResponse', request, h)

    expect(result).toBe('continue-symbol')
    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_http_requests_total',
      1,
      {
        route: '/api/v1/reference-data/vessels/{id}',
        method: 'GET',
        status_code: '200'
      }
    )
    expect(recordDuration).toHaveBeenCalledWith(
      'reference_data_http_request_duration_ms',
      expect.any(Number),
      {
        route: '/api/v1/reference-data/vessels/{id}',
        method: 'GET',
        status_code: '200'
      }
    )
  })

  test('uses the boom output status code for error responses', async () => {
    const server = createFakeServer()
    metricsHttp.plugin.register(server)

    const request = {
      route: { path: '/health/dependencies' },
      method: 'get',
      info: { received: Date.now() },
      response: { isBoom: true, output: { statusCode: 503 } }
    }

    await server.trigger('onPreResponse', request, { continue: true })

    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_http_requests_total',
      1,
      expect.objectContaining({ status_code: '503' })
    )
  })

  test('falls back to "unknown" for an unmatched route', async () => {
    const server = createFakeServer()
    metricsHttp.plugin.register(server)

    const request = {
      route: undefined,
      method: 'get',
      info: { received: Date.now() },
      response: { isBoom: true, output: { statusCode: 404 } }
    }

    await server.trigger('onPreResponse', request, { continue: true })

    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_http_requests_total',
      1,
      expect.objectContaining({ route: 'unknown' })
    )
  })
})
