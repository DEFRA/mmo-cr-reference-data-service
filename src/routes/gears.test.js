import { afterAll, describe, expect, test } from 'vitest'

import { createServer } from '#/server.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from '#/reference-data/query/collection-query-service.js'
import { gearsQueryConfiguration } from '#/reference-data/query/gears-query-configuration.js'
import { createCollectionRouteController } from '#/reference-data/controller/collection-route-controller.js'
import { addMobileMeasurements, addMobileItemContext } from '#/routes/gears.js'
import { createStubAuthenticationClient } from '#/routes/route-test-helpers.js'

const COLLECTION_PATH = '/__test/gears'
const ITEM_PATH = '/__test/gears/{id}'
const GEAR_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = 'aaaaaaaa-1111-4111-8111-111111111111'
const CHARACTERISTIC_ID = 'bbbbbbbb-1111-4111-8111-111111111111'

function buildGear(overrides = {}) {
  return {
    id: GEAR_ID,
    code: 'TBB',
    name: 'Beam trawl',
    type: 'trawl',
    categoryId: CATEGORY_ID,
    pairFishing: false,
    applicableCharacteristics: [
      {
        id: 'cccccccc-1111-4111-8111-111111111111',
        characteristicId: CHARACTERISTIC_ID,
        fixed: true,
        required: true,
        vesselLengthApplicability: ['under-10m']
      }
    ],
    active: true,
    ...overrides
  }
}

async function buildTestServer(gears = [buildGear()]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'gears',
    {
      categories: [{ id: CATEGORY_ID, code: 'TRAWL', name: 'Trawls' }],
      characteristics: [
        {
          id: CHARACTERISTIC_ID,
          code: 'MESH_SIZE',
          name: 'Mesh size',
          dataType: 'number',
          unit: 'mm',
          minValue: 1,
          maxValue: null
        }
      ],
      items: gears
    },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  const query = createCollectionQueryService({ store })
  const { collectionHandler, itemHandler } = createCollectionRouteController({
    config: gearsQueryConfiguration,
    query,
    authenticationClient: createStubAuthenticationClient(),
    postProcessCollectionBody: addMobileMeasurements,
    postProcessItemBody: addMobileItemContext
  })

  const server = await createServer()
  server.route([
    { method: 'GET', path: COLLECTION_PATH, handler: collectionHandler },
    { method: 'GET', path: ITEM_PATH, handler: itemHandler }
  ])
  await server.initialize()
  return server
}

describe('#gearsRoute', () => {
  let server

  afterAll(async () => {
    if (server) await server.stop()
  })

  test('returns the canonical gear collection, preserving fixed', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].applicableCharacteristics[0].fixed).toBe(true)
  })

  test('returns the mobile gear collection with page-specific measurements', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.measurements).toHaveLength(1)
    expect(body.measurements[0].code).toBe('MESH_SIZE')
    expect(body.items[0]).not.toHaveProperty('__referencedCharacteristicIds')
  })

  test('gear-code filter', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?code=TBB`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('category-code filter', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?categoryCode=TRAWL`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(1)
  })

  test('pairFishing filter excludes non-matching gears', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?pairFishing=true`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(JSON.parse(response.payload).items).toHaveLength(0)
  })

  test('vessel length under 10 metres includes the required measurement', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&vesselLengthMetres=8.5`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.context).toEqual({
      vesselLengthMetres: 8.5,
      vesselLengthBand: 'under-10m'
    })
    expect(body.items[0].requiredMeasurementIds).toEqual([CHARACTERISTIC_ID])
  })

  test('vessel length exactly 10 to 12 metres excludes an under-10m-only characteristic', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&vesselLengthMetres=11`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.context.vesselLengthBand).toBe('10-to-12m')
    expect(body.items[0].requiredMeasurementIds).toEqual([])
    expect(body.items[0].variableMeasurementIds).toEqual([])
  })

  test('vessel length over 12 metres excludes an under-10m-only characteristic', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&vesselLengthMetres=15`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.context.vesselLengthBand).toBe('over-12m')
    expect(body.items[0].requiredMeasurementIds).toEqual([])
  })

  test('variable measurement mapping when fixed is false', async () => {
    server = await buildTestServer([
      buildGear({
        applicableCharacteristics: [
          {
            id: 'dddddddd-1111-4111-8111-111111111111',
            characteristicId: CHARACTERISTIC_ID,
            fixed: false,
            required: false,
            vesselLengthApplicability: ['under-10m']
          }
        ]
      })
    ])
    const response = await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&vesselLengthMetres=8.5`,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(response.payload)
    expect(body.items[0].variableMeasurementIds).toEqual([CHARACTERISTIC_ID])
    expect(body.items[0].requiredMeasurementIds).toEqual([])
  })

  test('returns a gear by GUID', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: `/__test/gears/${GEAR_ID}`,
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).id).toBe(GEAR_ID)
  })

  test('unknown GUID returns 404', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/gears/99999999-9999-4999-8999-999999999999',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.payload).error.code).toBe(
      'reference_item_not_found'
    )
  })

  test('invalid GUID returns 400 with the standard error envelope', async () => {
    server = await buildTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/__test/gears/not-a-guid',
      headers: { authorization: 'Bearer read-token' }
    })
    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.payload)
    expect(body.error.code).toBe('invalid_request')
    expect(body.error.traceId).toEqual(expect.any(String))
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
    const etag = first.headers.etag

    const second = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token', 'if-none-match': etag }
    })
    expect(second.statusCode).toBe(304)
    expect(second.payload).toBe('')
  })

  test('canonical source is not mutated by a mobile-view request', async () => {
    server = await buildTestServer()
    await server.inject({
      method: 'GET',
      url: `${COLLECTION_PATH}?view=mobile&vesselLengthMetres=8.5`,
      headers: { authorization: 'Bearer read-token' }
    })
    const canonical = await server.inject({
      method: 'GET',
      url: COLLECTION_PATH,
      headers: { authorization: 'Bearer read-token' }
    })
    const body = JSON.parse(canonical.payload)
    expect(body.items[0].applicableCharacteristics[0].fixed).toBe(true)
    expect(body.items[0].applicableCharacteristics[0].required).toBe(true)
  })
})
