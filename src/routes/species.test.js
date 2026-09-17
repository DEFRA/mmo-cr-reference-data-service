import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { speciesQueryConfiguration } from '#/reference-data/query/species-query-configuration.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { getProjectionContext } from '#/routes/species.js'
import {
  createStubAuthenticationClient,
  buildCollectionRouteTestServer,
  registerServerTeardown,
  injectAuthenticatedGet
} from '#/routes/route-test-helpers.js'

const COLLECTION_PATH = '/__test/species'
const ITEM_PATH = '/__test/species/{id}'
const SPECIES_ID = '11111111-1111-4111-8111-111111111111'

function buildSpecies(overrides = {}) {
  return {
    id: SPECIES_ID,
    faoCode: 'COD',
    scientificName: 'Gadus morhua',
    commonNames: [{ id: 'a', countryCode: 'GBR', name: 'Cod' }],
    localNames: [
      { id: 'b', languageCode: 'cy-GB', name: 'Cod Cymraeg', official: true },
      { id: 'c', languageCode: 'en-GB', name: 'Official Cod', official: true }
    ],
    active: true,
    ...overrides
  }
}

async function buildTestServer(species = [buildSpecies()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'species',
    { items: species },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler, itemHandler } = createCollectionRouteController({
    config: speciesQueryConfiguration,
    query,
    authenticationClient: createStubAuthenticationClient(),
    getProjectionContext
  })

  return buildCollectionRouteTestServer({
    collectionPath: COLLECTION_PATH,
    itemPath: ITEM_PATH,
    collectionHandler,
    itemHandler
  })
}

describe('#speciesRoute', () => {
  let server

  registerServerTeardown(() => server)

  test('returns the canonical species collection with all names', async () => {
    server = await buildTestServer()
    const response = await injectAuthenticatedGet(server, COLLECTION_PATH)
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.items[0].commonNames).toHaveLength(1)
    expect(body.items[0].localNames).toHaveLength(2)
  })

  test('mobile view resolves display name via Accept-Language (Rule 1)', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: {
        authorization: 'Bearer read-token',
        'accept-language': 'cy-GB, en-GB;q=0.8'
      }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].displayName).toBe('Cod Cymraeg')
  })

  test('mobile view resolves display name via countryCode (Rule 2)', async () => {
    server = await buildTestServer([buildSpecies({ localNames: [] })])
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&countryCode=GBR`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].displayName).toBe('Cod')
  })

  test('mobile view falls back to official en-GB local name (Rule 3)', async () => {
    server = await buildTestServer([buildSpecies({ commonNames: [] })])
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].displayName).toBe('Official Cod')
  })

  test('mobile view falls back to scientific name (Rule 5)', async () => {
    server = await buildTestServer([
      buildSpecies({ commonNames: [], localNames: [] })
    ])
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].displayName).toBe('Gadus morhua')
  })

  test('mobile view falls back to FAO code (Rule 6)', async () => {
    server = await buildTestServer([
      buildSpecies({ commonNames: [], localNames: [], scientificName: '' })
    ])
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].displayName).toBe('COD')
  })

  test('faoCode filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?faoCode=cod`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('scientificName filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?scientificName=gadus%20morhua`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('countryCode filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?countryCode=gbr`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('languageCode filter matches the complete tag with no regional fallback', async () => {
    server = await buildTestServer()
    const exact = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?languageCode=en-GB`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(exact.payload).items).toHaveLength(1)

    const noFallback = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?languageCode=en`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(noFallback.payload).items).toHaveLength(0)
  })

  test('general text search matches scientific name', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?query=gadus`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('an invalid Accept-Language header returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: {
        authorization: 'Bearer read-token',
        'accept-language': '!!!not-valid!!!'
      }
    })
    expect(response.statusCode).toBe(400)
  })

  test('returns a species by GUID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `/__test/species/${SPECIES_ID}`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe(SPECIES_ID)
  })

  test('unknown GUID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/species/99999999-9999-4999-8999-999999999999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
  })

  test('invalid GUID returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/species/not-a-guid',
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
