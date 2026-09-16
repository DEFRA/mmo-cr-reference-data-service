import { afterAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { mapLandQueryConfiguration } from '#/reference-data/query/map-land-query-configuration.js'
import { createGeoJsonCollectionRouteController } from '#/reference-data/controller/geojson-collection-route-controller.js'
import {
  SQUARE_RING,
  createStubAuthenticationClient
} from '#/routes/geojson-route-test-helpers.js'

const MAP_LAND_PATH = '/__test/map/land'

const FEATURE_ID = '11111111-1111-4111-8111-111111111111'

function buildFeature(overrides = {}) {
  return {
    type: 'Feature',
    id: FEATURE_ID,
    properties: { id: FEATURE_ID, name: 'Island' },
    geometry: { type: 'Polygon', coordinates: [SQUARE_RING] },
    ...overrides
  }
}

async function buildTestServer(features = [buildFeature()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'map-land',
    { type: 'FeatureCollection', features },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler } = createGeoJsonCollectionRouteController({
    config: mapLandQueryConfiguration,
    query,
    authenticationClient: createStubAuthenticationClient()
  })

  const server = await createServer()
  server.route([
    { method: 'GET', path: MAP_LAND_PATH, handler: collectionHandler }
  ])
  await server.initialize()
  return server
}

describe('#mapLandRoute', () => {
  let server

  afterAll(async () => {
    if (server) await server.stop()
  })

  test('returns a GeoJSON FeatureCollection with the correct content type', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: MAP_LAND_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/geo+json')
    const body = JSON.parse(response.payload)
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toHaveLength(1)
    expect(body.features[0].id).toBe(FEATURE_ID)
  })

  test('general search matches by name', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${MAP_LAND_PATH}?query=island`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).features).toHaveLength(1)
  })

  test('bbox filters via true polygon intersection', async () => {
    server = await buildTestServer()
    const inside = await server.inject({
      method: 'GET',
      url: `${MAP_LAND_PATH}?bbox=2,2,8,8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(inside.payload).features).toHaveLength(1)

    const outside = await server.inject({
      method: 'GET',
      url: `${MAP_LAND_PATH}?bbox=50,50,60,60`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(outside.payload).features).toHaveLength(0)
  })

  test('an invalid bbox returns 400', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${MAP_LAND_PATH}?bbox=not-a-bbox`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
  })

  test('malformed persisted geometry returns a safe 500', async () => {
    server = await buildTestServer([
      buildFeature({ geometry: { type: 'Point', coordinates: [0, 0] } })
    ])
    const response = await server.inject({
      method: 'GET',
      url: `${MAP_LAND_PATH}?bbox=2,2,8,8`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('internal_error')
    expect(response.payload).not.toContain('coordinates')
  })

  test('missing token returns 401', async () => {
    server = await buildTestServer()
    const response = await server.inject({ method: 'GET', url: MAP_LAND_PATH })
    expect(response.statusCode).toBe(401)
  })

  test('a matching ETag returns 304 with no body', async () => {
    server = await buildTestServer()
    const first = await server.inject({
      method: 'GET',
      url: MAP_LAND_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    const second = await server.inject({
      method: 'GET',
      url: MAP_LAND_PATH,
      headers: {
        authorization: 'Bearer read-token',
        'if-none-match': first.headers.etag
      }
    })
    expect(second.statusCode).toBe(304)
    expect(second.payload).toBe('')
  })
})
