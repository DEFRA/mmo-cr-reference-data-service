import { describe, expect, test, vi } from 'vitest'

import { createManifestController } from './manifest-controller.js'

function createFakeToolkit() {
  const state = { payload: undefined, statusCode: undefined, headers: {} }
  const chain = {
    code: (statusCode) => {
      state.statusCode = statusCode
      return chain
    },
    header: (name, value) => {
      state.headers[name] = value
      return chain
    }
  }
  return {
    h: {
      response: (payload) => {
        state.payload = payload
        return chain
      }
    },
    state
  }
}

function createRequest({ authorization, ifNoneMatch, include } = {}) {
  return {
    app: { correlationId: 'test-correlation-id' },
    headers: {
      ...(authorization !== undefined ? { authorization } : {}),
      ...(ifNoneMatch !== undefined ? { 'if-none-match': ifNoneMatch } : {})
    },
    query: { include }
  }
}

const AUTHENTICATED_OUTCOME = {
  authenticated: true,
  actor: { actorId: 'actor-1', permissions: ['reference-data.read'] }
}

const MANIFEST_RESULT = {
  etag: '"sha256-abc"',
  body: {
    manifestId: 'm1',
    version: '1',
    generatedAt: '2026-01-01',
    datasets: []
  }
}

describe('#createManifestController', () => {
  test('returns 200 with body, ETag and Cache-Control on success', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED_OUTCOME)
    }
    const query = { getManifest: vi.fn(() => MANIFEST_RESULT) }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await handler(createRequest({ authorization: 'Bearer good-token' }), h)

    expect(state.statusCode).toBe(200)
    expect(state.payload).toBe(MANIFEST_RESULT.body)
    expect(state.headers.ETag).toBe(MANIFEST_RESULT.etag)
    expect(state.headers['Cache-Control']).toMatch(/public/)
    expect(authenticationClient.authenticate).toHaveBeenCalledWith({
      token: 'good-token',
      correlationId: 'test-correlation-id'
    })
  })

  test('passes the include query parameter through to the Query Module', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED_OUTCOME)
    }
    const query = { getManifest: vi.fn(() => MANIFEST_RESULT) }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await handler(
      createRequest({ authorization: 'Bearer good-token', include: 'ports' }),
      h
    )

    expect(query.getManifest).toHaveBeenCalledWith({ include: 'ports' })
  })

  test('returns 304 with no body when the ETag matches', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED_OUTCOME)
    }
    const query = { getManifest: vi.fn(() => MANIFEST_RESULT) }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await handler(
      createRequest({
        authorization: 'Bearer good-token',
        ifNoneMatch: MANIFEST_RESULT.etag
      }),
      h
    )

    expect(state.statusCode).toBe(304)
    expect(state.payload).toBeUndefined()
    expect(state.headers.ETag).toBe(MANIFEST_RESULT.etag)
  })

  test('throws unauthorized when no bearer token is supplied', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => ({
        authenticated: false,
        failure: {
          code: 'unauthorized',
          message: 'A bearer token is required.'
        }
      }))
    }
    const query = { getManifest: vi.fn() }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await expect(handler(createRequest(), h)).rejects.toMatchObject({
      code: 'unauthorized'
    })
    expect(query.getManifest).not.toHaveBeenCalled()
  })

  test('throws forbidden when the actor lacks read permission', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => ({
        authenticated: true,
        actor: { actorId: 'actor-1', permissions: [] }
      }))
    }
    const query = { getManifest: vi.fn() }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await expect(
      handler(createRequest({ authorization: 'Bearer good-token' }), h)
    ).rejects.toMatchObject({ code: 'forbidden' })
    expect(query.getManifest).not.toHaveBeenCalled()
  })

  test('extracts no token from a malformed authorization header', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED_OUTCOME)
    }
    const query = { getManifest: vi.fn(() => MANIFEST_RESULT) }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await handler(createRequest({ authorization: 'Basic abc123' }), h)

    expect(authenticationClient.authenticate).toHaveBeenCalledWith({
      token: null,
      correlationId: 'test-correlation-id'
    })
  })

  test('propagates reference_data_unavailable from the Query Module', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED_OUTCOME)
    }
    const unavailableError = Object.assign(new Error('unavailable'), {
      code: 'reference_data_unavailable'
    })
    const query = {
      getManifest: vi.fn(() => {
        throw unavailableError
      })
    }
    const { handler } = createManifestController({
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await expect(
      handler(createRequest({ authorization: 'Bearer good-token' }), h)
    ).rejects.toBe(unavailableError)
  })
})
