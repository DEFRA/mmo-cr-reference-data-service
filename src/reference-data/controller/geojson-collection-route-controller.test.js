import { describe, expect, test, vi } from 'vitest'

import { createGeoJsonCollectionRouteController } from './geojson-collection-route-controller.js'
import {
  createRequest,
  AUTHENTICATED,
  createBaseFakeToolkit
} from './controller-test-helpers.js'

function createFakeToolkit() {
  const state = {
    payload: undefined,
    statusCode: undefined,
    headers: {},
    contentType: undefined
  }
  const { chain, h } = createBaseFakeToolkit(state)
  chain.type = (contentType) => {
    state.contentType = contentType
    return chain
  }
  return { h, state }
}

const CONFIG = { dataset: 'map-land' }

describe('#createGeoJsonCollectionRouteController collectionHandler', () => {
  test('returns 200 with a FeatureCollection and geo+json content type', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      queryCollection: vi.fn(() => ({
        etag: '"e1"',
        metadata: { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' },
        totalCount: 1,
        items: [{ type: 'Feature', id: 'x' }]
      }))
    }
    const { collectionHandler } = createGeoJsonCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await collectionHandler(createRequest({ authorization: 'Bearer t' }), h)

    expect(state.statusCode).toBe(200)
    expect(state.contentType).toBe('application/geo+json')
    expect(state.payload).toEqual({
      type: 'FeatureCollection',
      metadata: {
        dataset: 'map-land',
        collectionId: 'c1',
        schemaVersion: '1.0',
        version: 'v1',
        crs: 'EPSG:4326',
        featureCount: 1
      },
      features: [{ type: 'Feature', id: 'x' }]
    })
  })

  test('returns 304 when ETag matches', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      queryCollection: vi.fn(() => ({
        etag: '"e1"',
        metadata: { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' },
        totalCount: 0,
        items: []
      }))
    }
    const { collectionHandler } = createGeoJsonCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await collectionHandler(
      createRequest({ authorization: 'Bearer t', ifNoneMatch: '"e1"' }),
      h
    )

    expect(state.statusCode).toBe(304)
    expect(state.payload).toBeUndefined()
  })

  test('throws unauthorized without a token', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => ({
        authenticated: false,
        failure: { code: 'unauthorized', message: 'no token' }
      }))
    }
    const query = { queryCollection: vi.fn() }
    const { collectionHandler } = createGeoJsonCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await expect(collectionHandler(createRequest(), h)).rejects.toMatchObject({
      code: 'unauthorized'
    })
    expect(query.queryCollection).not.toHaveBeenCalled()
  })
})

describe('#createGeoJsonCollectionRouteController itemHandler', () => {
  test('returns the bare Feature directly', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      getItemById: vi.fn(() => ({
        etag: '"e1"',
        item: { type: 'Feature', id: 'x', properties: {}, geometry: {} }
      }))
    }
    const { itemHandler } = createGeoJsonCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await itemHandler(
      createRequest({ authorization: 'Bearer t', params: { id: 'x' } }),
      h
    )

    expect(state.statusCode).toBe(200)
    expect(state.contentType).toBe('application/geo+json')
    expect(state.payload).toEqual({
      type: 'Feature',
      id: 'x',
      properties: {},
      geometry: {}
    })
  })

  test('propagates reference_item_not_found', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const notFound = Object.assign(new Error('missing'), {
      code: 'reference_item_not_found'
    })
    const query = {
      getItemById: vi.fn(() => {
        throw notFound
      })
    }
    const { itemHandler } = createGeoJsonCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h } = createFakeToolkit()

    await expect(
      itemHandler(
        createRequest({ authorization: 'Bearer t', params: { id: 'x' } }),
        h
      )
    ).rejects.toBe(notFound)
  })
})
