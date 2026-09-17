import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { portsQueryConfiguration } from '#/reference-data/query/ports-query-configuration.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import {
  createStubAuthenticationClient,
  buildCollectionRouteTestServer,
  registerServerTeardown,
  injectAuthenticatedGet
} from '#/routes/route-test-helpers.js'

const COLLECTION_PATH = '/__test/ports'
const ITEM_PATH = '/__test/ports/{id}'
const PORT_ID = '11111111-1111-4111-8111-111111111111'

function buildPort(overrides = {}) {
  return {
    id: PORT_ID,
    code: '0349',
    name: 'Plymouth',
    countryCode: 'GBR',
    coordinate: { latitude: 50.3661, longitude: -4.1427 },
    active: true,
    ...overrides
  }
}

async function buildTestServer(ports = [buildPort()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'ports',
    { items: ports },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler, itemHandler } = createCollectionRouteController({
    config: portsQueryConfiguration,
    query,
    authenticationClient: createStubAuthenticationClient()
  })

  return buildCollectionRouteTestServer({
    collectionPath: COLLECTION_PATH,
    itemPath: ITEM_PATH,
    collectionHandler,
    itemHandler
  })
}

describe('#portsRoute', () => {
  let server

  registerServerTeardown(() => server)

  test('returns the canonical port collection', async () => {
    server = await buildTestServer()
    const response = await injectAuthenticatedGet(server, COLLECTION_PATH)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('exact port-code filter is case-sensitive', async () => {
    server = await buildTestServer()
    const match = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?code=0349`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(match.payload).items).toHaveLength(1)

    const noMatch = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?code=ABCD`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(noMatch.payload).items).toHaveLength(0)
  })

  test('country-code filter is case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?countryCode=gbr`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('radius search requires all three parameters together', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?latitude=50.37`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
  })

  test('radius search includes ports within the radius', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?latitude=50.3661&longitude=-4.1427&radiusKm=10`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('radius search excludes ports outside the radius', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?latitude=60&longitude=0&radiusKm=1`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(0)
  })

  test('returns a port by GUID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `/__test/ports/${PORT_ID}`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe(PORT_ID)
  })

  test('unknown GUID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/ports/99999999-9999-4999-8999-999999999999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
  })

  test('missing token returns 401', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH
    })
    expect(response.statusCode).toBe(401)
  })

  test('a matching ETag returns 304 with no body', async () => {
    server = await buildTestServer()
    const first = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    const second = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: {
        authorization: 'Bearer read-token',
        'if-none-match': first.headers.etag
      }
    })
    expect(second.statusCode).toBe(304)
    expect(second.payload).toBe('')
  })
})
