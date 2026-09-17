import { describe, expect, test, vi } from 'vitest'

import { createCollectionRouteController } from './collection-route-controller.js'
import {
  createRequest,
  AUTHENTICATED,
  createBaseFakeToolkit
} from './controller-test-helpers.js'

function createFakeToolkit() {
  const state = { payload: undefined, statusCode: undefined, headers: {} }
  const { h } = createBaseFakeToolkit(state)
  return { h, state }
}

const CONFIG = { dataset: 'vessels' }

describe('#createCollectionRouteController collectionHandler', () => {
  test('returns 200 with the collection body', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      queryCollection: vi.fn(() => ({
        etag: '"e1"',
        metadata: { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' },
        view: 'canonical',
        totalCount: 1,
        items: [{ id: 'x' }]
      }))
    }
    const { collectionHandler } = createCollectionRouteController({
      config: CONFIG,
      query,
      authenticationClient
    })
    const { h, state } = createFakeToolkit()

    await collectionHandler(createRequest({ authorization: 'Bearer t' }), h)

    expect(state.statusCode).toBe(200)
    expect(state.payload).toEqual({
      dataset: 'vessels',
      collectionId: 'c1',
      schemaVersion: '1.0',
      version: 'v1',
      view: 'canonical',
      total: 1,
      items: [{ id: 'x' }]
    })
    expect(state.headers.ETag).toBe('"e1"')
  })

  test('returns 304 when ETag matches', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      queryCollection: vi.fn(() => ({
        etag: '"e1"',
        metadata: { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' },
        view: 'canonical',
        totalCount: 0,
        items: []
      }))
    }
    const { collectionHandler } = createCollectionRouteController({
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
    const { collectionHandler } = createCollectionRouteController({
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

describe('#createCollectionRouteController itemHandler', () => {
  test('returns 200 with the item body directly', async () => {
    const authenticationClient = {
      authenticate: vi.fn(async () => AUTHENTICATED)
    }
    const query = {
      getItemById: vi.fn(() => ({ etag: '"e1"', item: { id: 'x', name: 'X' } }))
    }
    const { itemHandler } = createCollectionRouteController({
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
    expect(state.payload).toEqual({ id: 'x', name: 'X' })
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
    const { itemHandler } = createCollectionRouteController({
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
