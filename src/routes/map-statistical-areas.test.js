import { afterAll, describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { mapStatisticalAreasQueryConfiguration } from '#/reference-data/query/map-statistical-areas-query-configuration.js'
import { createGeoJsonCollectionRouteController } from '#/reference-data/controller/geojson-collection-route-controller.js'
import {
  SQUARE_RING,
  createStubAuthenticationClient,
  buildCollectionRouteTestServer
} from '#/routes/geojson-route-test-helpers.js'

const COLLECTION_PATH = '/__test/map/statistical-areas'
const ITEM_PATH = '/__test/map/statistical-areas/{id}'
const FEATURE_ID = '11111111-1111-4111-8111-111111111111'

function buildFeature(overrides = {}) {
  return {
    type: 'Feature',
    id: FEATURE_ID,
    properties: {
      id: FEATURE_ID,
      code: '27D86',
      name: 'ICES subrectangle 27D86',
      areaType: 'ices-subrectangle',
      parentCode: '27D8',
      parentName: 'ICES rectangle 27D8'
    },
    geometry: { type: 'Polygon', coordinates: [SQUARE_RING] },
    ...overrides
  }
}

async function buildTestServer(features = [buildFeature()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'map-statistical-areas',
    { type: 'FeatureCollection', features },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler, itemHandler } =
    createGeoJsonCollectionRouteController({
      config: mapStatisticalAreasQueryConfiguration,
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

describe('#mapStatisticalAreasRoute', () => {
  let server

  afterAll(async () => {
    if (server) await server.stop()
  })

  test('returns a GeoJSON FeatureCollection', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('code filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?code=27d86`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('parentCode filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?parentCode=27d8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('general search covers name, code, areaType, parentCode, and parentName', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?query=ices-subrectangle`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('bbox filters via true polygon intersection', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?bbox=2,2,8,8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('returns a feature by GUID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `/__test/map/statistical-areas/${FEATURE_ID}`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe(FEATURE_ID)
  })

  test('unknown GUID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/map/statistical-areas/99999999-9999-4999-8999-999999999999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
  })

  test('invalid GUID returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/map/statistical-areas/not-a-guid',
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
