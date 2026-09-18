import { describe, expect, test } from 'vitest'

import { correlation, resolveCorrelationId } from './correlation.js'

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('#resolveCorrelationId', () => {
  test('preserves a valid supplied value', () => {
    expect(resolveCorrelationId('abc-123_XYZ')).toBe('abc-123_XYZ')
  })

  test('generates a value when none is supplied', () => {
    expect(resolveCorrelationId(undefined)).toMatch(GUID_PATTERN)
  })

  test('generates a value for an invalid supplied value (contains spaces)', () => {
    expect(resolveCorrelationId('has spaces')).toMatch(GUID_PATTERN)
  })

  test('generates a value for a non-string supplied value', () => {
    expect(resolveCorrelationId(42)).toMatch(GUID_PATTERN)
  })

  test('generates a different value than a rejected input each time', () => {
    const first = resolveCorrelationId('')
    const second = resolveCorrelationId('')
    expect(first).not.toBe(second)
  })
})

describe('#correlation plugin', () => {
  function registerAndGetExtHandlers() {
    const handlers = {}
    const fakeServer = {
      ext: (event, handler) => {
        handlers[event] = handler
      }
    }
    correlation.plugin.register(fakeServer)
    return handlers
  }

  test('onRequest sets request.app.correlationId from the tracing header', () => {
    const handlers = registerAndGetExtHandlers()
    const request = {
      app: {},
      headers: { 'x-cdp-request-id': 'supplied-id' }
    }
    const h = { continue: 'continue-symbol' }

    const result = handlers.onRequest(request, h)

    expect(request.app.correlationId).toBe('supplied-id')
    expect(result).toBe('continue-symbol')
  })

  test('onPreResponse sets the tracing header on a non-Boom response', () => {
    const handlers = registerAndGetExtHandlers()
    const headerCalls = []
    const request = {
      app: { correlationId: 'corr-1' },
      response: {
        isBoom: false,
        header: (name, value) => headerCalls.push([name, value])
      }
    }
    const h = { continue: 'continue-symbol' }

    const result = handlers.onPreResponse(request, h)

    expect(headerCalls).toEqual([['x-cdp-request-id', 'corr-1']])
    expect(result).toBe('continue-symbol')
  })

  test('onPreResponse sets the tracing header on a Boom response via output.headers', () => {
    const handlers = registerAndGetExtHandlers()
    const request = {
      app: { correlationId: 'corr-2' },
      response: { isBoom: true, output: { headers: {} } }
    }
    const h = { continue: 'continue-symbol' }

    handlers.onPreResponse(request, h)

    expect(request.response.output.headers['x-cdp-request-id']).toBe('corr-2')
  })
})
