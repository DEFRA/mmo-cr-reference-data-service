import { afterAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { config } from '#/config.js'
import { createManifestController } from '#/reference-data/controller/manifest-controller.js'
import { parseIncludeFilter } from '#/reference-data/query/manifest-include-filter.js'

const TRACING_HEADER = config.get('tracing.header')
// createServer() already registers the production manifest route at
// MANIFEST_ROUTE_PATH (see routes/manifest.js); this suite exercises the same
// controller through the real Hapi pipeline with stubbed Query/Authentication
// dependencies at a distinct path to avoid a duplicate-route conflict.
const MANIFEST_ROUTE_PATH = '/__test/manifest'

const VALID_MANIFEST_RESULT = {
  etag: '"sha256-abc"',
  body: {
    manifestId: 'c7b49c26-d6c0-4ab1-9318-cd1c862f4768',
    version: '2026.09.11.3',
    generatedAt: '2026-09-11T08:32:14Z',
    datasets: [
      {
        dataset: 'ports',
        collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
        schemaVersion: '1.0',
        version: '2026.09.11.1',
        etag: '"a"',
        url: '/api/v1/reference-data/ports',
        format: 'json',
        itemCount: 1,
        lastModified: '2026-09-11T08:30:00Z'
      }
    ]
  }
}

function createStubAuthenticationClient({ tokens = {} } = {}) {
  return {
    authenticate: async ({ token }) => {
      const outcome = tokens[token]
      if (!outcome) {
        return {
          authenticated: false,
          failure: { code: 'unauthorized', message: 'invalid token' }
        }
      }
      return { authenticated: true, actor: outcome }
    }
  }
}

function createStubQuery({ manifestResult, unavailable = false } = {}) {
  return {
    getManifest: ({ include } = {}) => {
      if (unavailable) {
        const error = new Error('not hydrated')
        error.code = 'reference_data_unavailable'
        throw error
      }
      // Reuses the real include-filter validation so this stub still exercises
      // the 400 invalid_request path exactly as the production Query Module would.
      const includeFilter = parseIncludeFilter(include)
      if (!includeFilter) {
        return manifestResult
      }
      return {
        etag: manifestResult.etag,
        body: {
          ...manifestResult.body,
          datasets: manifestResult.body.datasets.filter((entry) =>
            includeFilter.includes(entry.dataset)
          )
        }
      }
    }
  }
}

async function buildTestServer({
  authenticationClient = createStubAuthenticationClient({
    tokens: {
      'read-token': { actorId: 'actor-1', permissions: ['reference-data.read'] }
    }
  }),
  query = createStubQuery({ manifestResult: VALID_MANIFEST_RESULT })
} = {}) {
  const server = await createServer()
  const { handler } = createManifestController({ query, authenticationClient })
  server.route([{ method: 'GET', path: MANIFEST_ROUTE_PATH, handler }])
  await server.initialize()
  return server
}

describe('#manifestRoute', () => {
  let server

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('a valid authorised request returns 200 with the manifest body', async () => {
    server = await buildTestServer()

    const response = await server.inject({
      method: 'GET',
      url: MANIFEST_ROUTE_PATH,
      headers: { authorization: 'Bearer read-token' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    expect(JSON.parse(response.payload)).toEqual(VALID_MANIFEST_RESULT.body)
    expect(response.headers.etag).toBe(VALID_MANIFEST_RESULT.etag)
    expect(response.headers['cache-control']).toMatch(/public/)
    expect(response.headers[TRACING_HEADER]).toBeDefined()
  })

  test('a filtered request returns only the requested dataset', async () => {
    server = await buildTestServer()

    const response = await server.inject({
      method: 'GET',
      url: `${MANIFEST_ROUTE_PATH}?include=ports`,
      headers: { authorization: 'Bearer read-token' }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).datasets).toHaveLength(1)
  })

  test('an unsupported include value returns 400', async () => {
    server = await buildTestServer()

    const response = await server.inject({
      method: 'GET',
      url: `${MANIFEST_ROUTE_PATH}?include=unknown`,
      headers: { authorization: 'Bearer read-token' }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('invalid_request')
  })

  test('a matching If-None-Match returns 304 with no body', async () => {
    server = await buildTestServer()

    const response = await server.inject({
      method: 'GET',
      url: MANIFEST_ROUTE_PATH,
      headers: {
        authorization: 'Bearer read-token',
        'if-none-match': VALID_MANIFEST_RESULT.etag
      }
    })

    expect(response.statusCode).toBe(304)
    expect(response.payload).toBe('')
    expect(response.headers.etag).toBe(VALID_MANIFEST_RESULT.etag)
    expect(response.headers[TRACING_HEADER]).toBeDefined()
  })

  test('a missing bearer token returns 401', async () => {
    server = await buildTestServer()

    const response = await server.inject({
      method: 'GET',
      url: MANIFEST_ROUTE_PATH
    })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.payload).error.code).toBe('unauthorized')
  })

  test('a token lacking read permission returns 403', async () => {
    server = await buildTestServer({
      authenticationClient: createStubAuthenticationClient({
        tokens: { 'write-only-token': { actorId: 'a', permissions: [] } }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: MANIFEST_ROUTE_PATH,
      headers: { authorization: 'Bearer write-only-token' }
    })

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.payload).error.code).toBe('forbidden')
  })

  test('an unavailable manifest returns 503, not an empty successful manifest', async () => {
    server = await buildTestServer({
      query: createStubQuery({ unavailable: true })
    })

    const response = await server.inject({
      method: 'GET',
      url: MANIFEST_ROUTE_PATH,
      headers: { authorization: 'Bearer read-token' }
    })

    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.payload).error.code).toBe(
      'reference_data_unavailable'
    )
  })
})
