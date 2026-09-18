import { describe, expect, test, vi } from 'vitest'

vi.mock('@defra/hapi-tracing', () => ({ getTraceId: vi.fn() }))

describe('#loggerOptions', () => {
  test('mixin includes trace.id when a trace id is present', async () => {
    const { getTraceId } = await import('@defra/hapi-tracing')
    getTraceId.mockReturnValue('trace-123')
    const { loggerOptions } = await import('./logger-options.js')

    expect(loggerOptions.mixin()).toEqual({ trace: { id: 'trace-123' } })
  })

  test('mixin omits trace when no trace id is present', async () => {
    const { getTraceId } = await import('@defra/hapi-tracing')
    getTraceId.mockReturnValue(undefined)
    const { loggerOptions } = await import('./logger-options.js')

    expect(loggerOptions.mixin()).toEqual({})
  })
})
