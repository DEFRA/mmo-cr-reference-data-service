import { describe, expect, test } from 'vitest'

import { createErrorEnvelope } from './error-envelope.js'

describe('#createErrorEnvelope', () => {
  test('includes required properties', () => {
    const envelope = createErrorEnvelope({
      code: 'internal_server_error',
      message: 'x',
      traceId: 't1'
    })
    expect(envelope).toEqual({
      error: { code: 'internal_server_error', message: 'x', traceId: 't1' }
    })
  })

  test('omits optional properties when undefined', () => {
    const envelope = createErrorEnvelope({
      code: 'c',
      message: 'm',
      traceId: 't'
    })
    expect(envelope.error).not.toHaveProperty('dataset')
    expect(envelope.error).not.toHaveProperty('retryable')
    expect(envelope.error).not.toHaveProperty('details')
  })

  test('includes optional properties only when defined', () => {
    const envelope = createErrorEnvelope({
      code: 'c',
      message: 'm',
      traceId: 't',
      dataset: 'ports',
      retryable: false,
      details: [{ path: 'a', message: 'b' }]
    })
    expect(envelope.error.dataset).toBe('ports')
    expect(envelope.error.retryable).toBe(false)
    expect(envelope.error.details).toEqual([{ path: 'a', message: 'b' }])
  })
})
