import { describe, expect, test, vi, beforeEach } from 'vitest'

const counterMock = vi.fn().mockResolvedValue(undefined)
const gaugeMock = vi.fn().mockResolvedValue(undefined)
const millisMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@defra/cdp-metrics', () => ({
  Metrics: vi.fn().mockImplementation(function FakeMetrics() {
    return {
      counter: counterMock,
      gauge: gaugeMock,
      millis: millisMock
    }
  })
}))

import {
  recordCounter,
  recordDuration,
  recordGauge,
  METRIC_NAMES
} from './metrics.js'
import { config } from '#/config.js'

beforeEach(() => {
  counterMock.mockClear()
  gaugeMock.mockClear()
  millisMock.mockClear()
  config.set('observability.metricsEnabled', true)
})

describe('#metrics', () => {
  test('records a counter with allowlisted dimensions', () => {
    recordCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL, 1, {
      route: '/api/v1/reference-data/vessels',
      method: 'GET',
      status_code: '200'
    })

    expect(counterMock).toHaveBeenCalledWith(
      METRIC_NAMES.HTTP_REQUESTS_TOTAL,
      1,
      {
        route: '/api/v1/reference-data/vessels',
        method: 'GET',
        status_code: '200'
      }
    )
  })

  test('records a duration metric', () => {
    recordDuration(METRIC_NAMES.QUERY_DURATION_MS, 42, { dataset: 'vessels' })

    expect(millisMock).toHaveBeenCalledWith(
      METRIC_NAMES.QUERY_DURATION_MS,
      42,
      { dataset: 'vessels' }
    )
  })

  test('records a gauge metric', () => {
    recordGauge(METRIC_NAMES.READINESS, 1)

    expect(gaugeMock).toHaveBeenCalledWith(METRIC_NAMES.READINESS, 1, {})
  })

  test('drops any dimension key not on the allowlist', () => {
    recordCounter(METRIC_NAMES.QUERY_REQUESTS_TOTAL, 1, {
      dataset: 'vessels',
      correlationId: 'should-not-appear',
      objectKey: 'reference-data/vessels/v1.json',
      filename: 'upload.json',
      businessIdentifier: 'CFR123'
    })

    expect(counterMock).toHaveBeenCalledWith(
      METRIC_NAMES.QUERY_REQUESTS_TOTAL,
      1,
      { dataset: 'vessels' }
    )
  })

  test('does not record anything when metrics are disabled', () => {
    config.set('observability.metricsEnabled', false)

    recordCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL)
    recordDuration(METRIC_NAMES.QUERY_DURATION_MS, 10)
    recordGauge(METRIC_NAMES.READINESS, 1)

    expect(counterMock).not.toHaveBeenCalled()
    expect(millisMock).not.toHaveBeenCalled()
    expect(gaugeMock).not.toHaveBeenCalled()
  })

  test('isolates a synchronous failure without throwing', () => {
    counterMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    expect(() => recordCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL)).not.toThrow()
  })

  test('isolates a rejected promise without an unhandled rejection', async () => {
    counterMock.mockRejectedValueOnce(new Error('async boom'))

    expect(() => recordCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL)).not.toThrow()
    // Allow the rejected promise's .catch() handler to run.
    await new Promise((resolve) => setImmediate(resolve))
  })
})
