import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { mapStatisticalAreasQueryConfiguration } from '#/reference-data/query/map-statistical-areas-query-configuration.js'
import { createGeoJsonCollectionRouteController } from '#/reference-data/controller/geojson-collection-route-controller.js'
import {
  createStubAuthenticationClient,
  buildCollectionRouteTestServer,
  registerServerTeardown,
  injectAuthenticatedGet
} from '#/routes/geojson-route-test-helpers.js'

const COLLECTION_PATH = '/__test/map/statistical-areas'
const ITEM_PATH = '/__test/map/statistical-areas/{id}'

const SQUARE_METRE_RING = [
  [-556597.45, 6446275.84],
  [-500937.71, 6446275.84],
  [-500937.71, 6489684.53],
  [-556597.45, 6489684.53],
  [-556597.45, 6446275.84]
]

const COLLECTION_CRS = {
  type: 'name',
  properties: { name: 'urn:ogc:def:crs:EPSG::3857' }
}

function buildFeature(overrides = {}) {
  return {
    type: 'Feature',
    properties: {
      OBJECTID: 1,
      ICESNAME: '27D8',
      sub_code: '27D85'
    },
    geometry: { type: 'MultiPolygon', coordinates: [[SQUARE_METRE_RING]] },
    ...overrides
  }
}

async function buildTestServer(features = [buildFeature()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'map-statistical-areas',
    { type: 'FeatureCollection', crs: COLLECTION_CRS, features },
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

  registerServerTeardown(() => server)

  test('returns a GeoJSON FeatureCollection with EPSG:3857 metadata and raw top-level crs', async () => {
    server = await buildTestServer()
    const response = await injectAuthenticatedGet(server, COLLECTION_PATH)
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    const body = JSON.parse(response.payload)
    expect(body.features).toHaveLength(1)
    expect(body.metadata.crs).toBe('EPSG:3857')
    expect(body.crs).toEqual(COLLECTION_CRS)
  })

  test('sub_code filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?sub_code=27d85`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('ICESNAME filter is exact and case-insensitive', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?ICESNAME=27d8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('general search covers ICESNAME and sub_code', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?query=27D85`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('bbox is removed and returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?bbox=2,2,8,8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
  })

  test('code and parentCode are removed and return 400', async () => {
    server = await buildTestServer()
    const codeResponse = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?code=27D85`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(codeResponse.statusCode).toBe(400)

    const parentCodeResponse = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?parentCode=27D8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(parentCodeResponse.statusCode).toBe(400)
  })

  test('returns a feature by OBJECTID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/map/statistical-areas/1',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.properties.OBJECTID).toBe(1)
    expect(body.geometry.type).toBe('MultiPolygon')
    expect(body.id).toBeUndefined()
  })

  test('unknown OBJECTID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/map/statistical-areas/999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
  })

  test('a non-integer OBJECTID returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/map/statistical-areas/not-a-number',
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
