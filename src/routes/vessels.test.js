import { afterAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { vesselsQueryConfiguration } from '#/reference-data/query/vessels-query-configuration.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'

const COLLECTION_PATH = '/__test/vessels'
const ITEM_PATH = '/__test/vessels/{id}'
const VESSEL_ID = '11111111-1111-4111-8111-111111111111'

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

async function buildTestServer() {
  const store = createInMemoryDataStore()
  store.setCollection(
    'vessels',
    {
      items: [
        {
          id: VESSEL_ID,
          name: 'Achilles',
          namePln: 'ACHILLES PH1234',
          identifiers: {
            cfr: 'GBR000A1234',
            uvi: null,
            mmsi: '232001234',
            ircs: 'MABC7',
            externalMark: 'PH1234',
            registrationNumber: 'PH1234'
          },
          typeCode: 'FISHING',
          registrationCountryCode: 'GBR',
          lengthOverallMetres: 8.74,
          status: 'active',
          activeFrom: '2015-03-17',
          activeTo: null
        }
      ]
    },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler, itemHandler } = createCollectionRouteController({
    config: vesselsQueryConfiguration,
    query,
    authenticationClient: createStubAuthenticationClient()
  })

  const server = await createServer()
  server.route([
    { method: 'GET', path: COLLECTION_PATH, handler: collectionHandler },
    { method: 'GET', path: ITEM_PATH, handler: itemHandler }
  ])
  await server.initialize()
  return server
}

describe('#vesselsRoute', () => {
  let server

  afterAll(async () => {
    if (server) await server.stop()
  })

  test('returns the canonical vessel collection', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.items).toHaveLength(1)
    expect(body.view).toBe('canonical')
  })

  test('returns the mobile vessel collection', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0]).toHaveProperty('displayName')
  })

  test('searches by name', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?query=achilles`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('returns a vessel by GUID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `/__test/vessels/${VESSEL_ID}`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe(VESSEL_ID)
  })

  test('unknown GUID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/vessels/99999999-9999-4999-8999-999999999999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
  })

  test('invalid GUID returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/vessels/not-a-guid',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
  })

  test('missing token returns 401', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH
    })
    expect(response.statusCode).toBe(401)
  })
})
