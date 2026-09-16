import { afterAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createMapPortsQueryService } from '#/reference-data/query/map-ports-query-service.js'
import { createMapPortsController } from '#/reference-data/controller/map-ports-controller.js'

const MAP_PORTS_PATH = '/__test/map/ports'

const PORT_WITH_COORDINATE = {
  id: '11111111-1111-4111-8111-111111111111',
  code: '0349',
  name: 'Plymouth',
  countryCode: 'GBR',
  coordinate: { latitude: 50.3661, longitude: -4.1427 },
  active: true
}

const PORT_WITHOUT_COORDINATE = {
  id: '22222222-2222-4222-8222-222222222222',
  code: '9999',
  name: 'Unknown',
  countryCode: 'GBR',
  coordinate: null,
  active: true
}

function createStubAuthenticationClient() {
  return {
    authenticate: async ({ token }) =>
      token === 'read-token'
        ? {
            authenticated: true,
            actor: { actorId: 'a1', permissions: ['reference-data.read'] }
          }
        : {
            authenticated: false,
            failure: { code: 'unauthorized', message: 'x' }
          }
  }
}

async function buildTestServer(
  ports = [PORT_WITH_COORDINATE, PORT_WITHOUT_COORDINATE]
) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'ports',
    { items: ports },
    { collectionId: 'c1', version: 'v1' }
  )
  const query = createMapPortsQueryService({ store })
  const { handler } = createMapPortsController({
    query,
    authenticationClient: createStubAuthenticationClient()
  })

  const server = await createServer()
  server.route([{ method: 'GET', path: MAP_PORTS_PATH, handler }])
  await server.initialize()
  return server
}

describe('#mapPortsRoute', () => {
  let server

  afterAll(async () => {
    if (server) await server.stop()
  })

  test('returns a GeoJSON FeatureCollection with the correct content type', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: MAP_PORTS_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    const body = JSON.parse(response.payload)
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toHaveLength(1)
  })

  test('excludes ports without coordinates from the map, but not the JSON collection', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: MAP_PORTS_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.features.map((f) => f.id)).not.toContain(
      PORT_WITHOUT_COORDINATE.id
    )
  })

  test('applies a bbox filter', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${MAP_PORTS_PATH}?bbox=-10,40,0,55`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('an invalid bbox returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${MAP_PORTS_PATH}?bbox=not-a-bbox`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
  })

  test('missing token returns 401', async () => {
    server = await buildTestServer()
    const response = await server.inject({ method: 'GET', url: MAP_PORTS_PATH })
    expect(response.statusCode).toBe(401)
  })

  test('a matching ETag returns 304 with no body', async () => {
    server = await buildTestServer()
    const first = await server.inject({
      method: 'GET',
      url: MAP_PORTS_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    const second = await server.inject({
      method: 'GET',
      url: MAP_PORTS_PATH,
      headers: {
        authorization: 'Bearer read-token',
        'if-none-match': first.headers.etag
      }
    })
    expect(second.statusCode).toBe(304)
    expect(second.payload).toBe('')
  })

  test('an unavailable ports collection returns 503', async () => {
    const store = createInMemoryDataStore()
    const query = createMapPortsQueryService({ store })
    const { handler } = createMapPortsController({
      query,
      authenticationClient: createStubAuthenticationClient()
    })
    const unavailableServer = await createServer()
    unavailableServer.route([{ method: 'GET', path: MAP_PORTS_PATH, handler }])
    await unavailableServer.initialize()

    const response = await unavailableServer.inject({
      method: 'GET',
      url: MAP_PORTS_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(503)
    await unavailableServer.stop()
  })
})
