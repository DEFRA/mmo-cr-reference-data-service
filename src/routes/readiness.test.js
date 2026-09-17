import { describe, expect, test, vi } from 'vitest'

vi.mock('#/reference-data/cache-refresh/index.js', () => ({
  cacheRefresh: { getReadinessState: vi.fn() }
}))

import { readiness } from './readiness.js'
import { cacheRefresh } from '#/reference-data/cache-refresh/index.js'
import { createFakeToolkit } from './route-test-helpers.js'

describe('#readinessRoute', () => {
  test('returns 200 with a safe summary when ready', () => {
    cacheRefresh.getReadinessState.mockReturnValue({
      ready: true,
      hydrated: true,
      missingMandatoryDatasets: [],
      lastHydratedAt: '2026-09-16T08:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshStatus: null
    })

    const { h, calls } = createFakeToolkit()
    readiness.handler({}, h)

    expect(calls.statusCode).toBe(200)
    expect(calls.payload).toEqual({
      status: 'ready',
      ready: true,
      hydrated: true,
      timestamp: expect.any(String),
      datasets: {
        mandatory: { expected: 6, loaded: 6, missing: [] }
      },
      missingMandatoryDatasets: [],
      lastHydratedAt: '2026-09-16T08:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshStatus: null
    })
  })

  test('returns 503 with missing mandatory datasets when not ready', () => {
    cacheRefresh.getReadinessState.mockReturnValue({
      ready: false,
      hydrated: true,
      missingMandatoryDatasets: ['species'],
      lastHydratedAt: '2026-09-16T08:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshStatus: null
    })

    const { h, calls } = createFakeToolkit()
    readiness.handler({}, h)

    expect(calls.statusCode).toBe(503)
    expect(calls.payload.status).toBe('not-ready')
    expect(calls.payload.ready).toBe(false)
    expect(calls.payload.missingMandatoryDatasets).toEqual(['species'])
    expect(calls.payload.datasets.mandatory).toEqual({
      expected: 6,
      loaded: 5,
      missing: ['species']
    })
  })

  test('reports a shutting-down status without forwarding the raw flag', () => {
    cacheRefresh.getReadinessState.mockReturnValue({
      ready: false,
      hydrated: true,
      shuttingDown: true,
      missingMandatoryDatasets: [],
      lastHydratedAt: '2026-09-16T08:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshStatus: null
    })

    const { h, calls } = createFakeToolkit()
    readiness.handler({}, h)

    expect(calls.statusCode).toBe(503)
    expect(calls.payload.status).toBe('shutting-down')
    expect(calls.payload).not.toHaveProperty('shuttingDown')
  })

  test('returns Cache-Control: no-store', () => {
    cacheRefresh.getReadinessState.mockReturnValue({
      ready: true,
      hydrated: true,
      missingMandatoryDatasets: [],
      lastHydratedAt: null,
      lastRefreshAt: null,
      lastRefreshStatus: null
    })

    const { h, calls } = createFakeToolkit()
    readiness.handler({}, h)

    expect(calls.headers['Cache-Control']).toBe('no-store')
  })

  test('never exposes internal cache-refresh state beyond the safe summary', () => {
    cacheRefresh.getReadinessState.mockReturnValue({
      ready: true,
      hydrated: true,
      shuttingDown: false,
      missingMandatoryDatasets: [],
      lastHydratedAt: null,
      lastRefreshAt: null,
      lastRefreshStatus: null,
      internalManifest: { secret: 'should-not-leak' }
    })

    const { h, calls } = createFakeToolkit()
    readiness.handler({}, h)

    expect(calls.payload).not.toHaveProperty('internalManifest')
    expect(calls.payload).not.toHaveProperty('shuttingDown')
  })
})
