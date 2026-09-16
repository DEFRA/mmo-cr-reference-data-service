import { describe, expect, test, vi } from 'vitest'

vi.mock('#/reference-data/cache-refresh/index.js', () => ({
  cacheRefresh: { getReadinessState: vi.fn() }
}))

import { readiness } from './readiness.js'
import { cacheRefresh } from '#/reference-data/cache-refresh/index.js'

function createFakeToolkit() {
  const calls = { payload: undefined, statusCode: undefined }
  return {
    h: {
      response: (payload) => {
        calls.payload = payload
        return {
          code: (statusCode) => {
            calls.statusCode = statusCode
            return calls
          }
        }
      }
    },
    calls
  }
}

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

    expect(calls.statusCode).toBeUndefined()
    expect(calls.payload).toEqual({
      ready: true,
      hydrated: true,
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
    expect(calls.payload.ready).toBe(false)
    expect(calls.payload.missingMandatoryDatasets).toEqual(['species'])
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
