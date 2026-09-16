/* global fetchMock */
import { beforeEach, describe, expect, test } from 'vitest'

import { createHttpAuthenticationClient } from './http-authentication-client.js'

// fetchMock is set globally by .vite/setup-files.js (vitest-fetch-mock).

beforeEach(() => {
  fetchMock.resetMocks()
})

describe('#createHttpAuthenticationClient construction', () => {
  test('constructing the client performs no network request', () => {
    createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('can be replaced with a test double implementing the same contract', async () => {
    const client = createHttpAuthenticationClient({
      baseUrl: null,
      timeoutMs: 100
    })
    expect(typeof client.authenticate).toBe('function')
  })

  test('a missing token causes no external request', async () => {
    const client = createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100
    })
    const outcome = await client.authenticate({ token: undefined })
    expect(outcome.authenticated).toBe(false)
    expect(outcome.failure.code).toBe('unauthorized')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('missing configuration (no baseUrl) fails safely without a network call', async () => {
    const client = createHttpAuthenticationClient({
      baseUrl: null,
      timeoutMs: 100
    })
    const outcome = await client.authenticate({ token: 'a-token' })
    expect(outcome.authenticated).toBe(false)
    expect(outcome.failure.code).toBe('authentication_service_unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('#createHttpAuthenticationClient token forwarding', () => {
  test('forwards a valid token as a Bearer header exactly once', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        actorId: 'actor-1',
        permissions: ['reference-data.read']
      })
    )
    const client = createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100
    })

    await client.authenticate({ token: 'valid-token', correlationId: 'corr-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://auth.example/validate')
    expect(options.headers.Authorization).toBe('Bearer valid-token')
    expect(options.headers['x-cdp-request-id']).toBe('corr-1')
  })

  test('the raw token is not present anywhere in the authentication result', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ actorId: 'actor-1', permissions: [] })
    )
    const client = createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100
    })

    const outcome = await client.authenticate({ token: 'super-secret-token' })

    expect(JSON.stringify(outcome)).not.toContain('super-secret-token')
  })
})

describe('#createHttpAuthenticationClient response mapping', () => {
  function client(overrides = {}) {
    return createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100,
      ...overrides
    })
  }

  test('a valid success response maps to an authenticated actor', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        actorId: 'actor-1',
        permissions: ['reference-data.read', 'reference-data.write']
      })
    )

    const outcome = await client().authenticate({ token: 't' })

    expect(outcome).toEqual({
      authenticated: true,
      actor: {
        actorId: 'actor-1',
        permissions: ['reference-data.read', 'reference-data.write']
      },
      correlationId: undefined
    })
  })

  test('a malformed success response fails closed', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ actorId: 123 }))

    const outcome = await client().authenticate({ token: 't' })

    expect(outcome.authenticated).toBe(false)
    expect(outcome.failure.code).toBe('authentication_service_unavailable')
  })

  test('missing permission information fails closed', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ actorId: 'actor-1' }))

    const outcome = await client().authenticate({ token: 't' })

    expect(outcome.authenticated).toBe(false)
  })

  test('a 401 response maps to unauthorized and is not retried', async () => {
    fetchMock.mockResponseOnce('', { status: 401 })

    const outcome = await client({ retryCount: 2 }).authenticate({
      token: 'bad-token'
    })

    expect(outcome.failure.code).toBe('unauthorized')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('a 403 response maps to forbidden', async () => {
    fetchMock.mockResponseOnce('', { status: 403 })

    const outcome = await client().authenticate({ token: 't' })

    expect(outcome.failure.code).toBe('forbidden')
  })
})

describe('#createHttpAuthenticationClient dependency failures', () => {
  test('a connection failure maps to authentication_service_unavailable', async () => {
    fetchMock.mockRejectOnce(new TypeError('fetch failed'))

    const outcome = await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100
    }).authenticate({ token: 't' })

    expect(outcome.failure.code).toBe('authentication_service_unavailable')
  })

  test('a 500 response is not retried and maps to unavailable', async () => {
    fetchMock.mockResponseOnce('', { status: 500 })

    const outcome = await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100,
      retryCount: 3
    }).authenticate({ token: 't' })

    expect(outcome.failure.code).toBe('authentication_service_unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('#createHttpAuthenticationClient bounded retries', () => {
  test('retries an approved transient (503) failure up to the configured bound', async () => {
    fetchMock
      .mockResponseOnce('', { status: 503 })
      .mockResponseOnce(JSON.stringify({ actorId: 'actor-1', permissions: [] }))

    const outcome = await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100,
      retryCount: 2,
      retryDelayMs: 0
    }).authenticate({ token: 't' })

    expect(outcome.authenticated).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('retry count is bounded: exhausts attempts and fails', async () => {
    fetchMock.mockResponse('', { status: 503 })

    const outcome = await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100,
      retryCount: 2,
      retryDelayMs: 0
    }).authenticate({ token: 't' })

    expect(outcome.failure.code).toBe('authentication_service_unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('does not use real delays in tests', async () => {
    const start = Date.now()
    fetchMock.mockResponse('', { status: 503 })

    await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 100,
      retryCount: 1,
      retryDelayMs: 0
    }).authenticate({ token: 't' })

    expect(Date.now() - start).toBeLessThan(500)
  })
})

describe('#createHttpAuthenticationClient timeout', () => {
  test('a slow response is aborted at the configured timeout and mapped to unavailable', async () => {
    fetchMock.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
    )

    const outcome = await createHttpAuthenticationClient({
      baseUrl: 'https://auth.example',
      timeoutMs: 10
    }).authenticate({ token: 't' })

    expect(outcome.failure.code).toBe('authentication_service_unavailable')
  }, 2000)
})
