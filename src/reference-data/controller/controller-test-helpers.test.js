import { describe, expect, test } from 'vitest'

import {
  createRequest,
  createFakePersistence,
  createBaseFakeToolkit
} from './controller-test-helpers.js'

describe('#createRequest', () => {
  test('omits authorization and if-none-match headers when not supplied', () => {
    const request = createRequest()
    expect(request.headers).toEqual({})
  })

  test('includes supplied authorization and if-none-match headers', () => {
    const request = createRequest({
      authorization: 'Bearer x',
      ifNoneMatch: '"etag-1"'
    })
    expect(request.headers).toEqual({
      authorization: 'Bearer x',
      'if-none-match': '"etag-1"'
    })
  })
})

describe('#createFakePersistence', () => {
  test('readManifest throws dataset_not_found before any manifest has been written', async () => {
    const persistence = createFakePersistence()
    await expect(persistence.readManifest()).rejects.toMatchObject({
      code: 'dataset_not_found'
    })
  })

  test('writeCollection stores a new object and returns its metadata', async () => {
    const persistence = createFakePersistence()
    const result = await persistence.writeCollection({
      dataset: 'ports',
      collectionVersion: 'v1',
      content: { items: [] }
    })
    expect(result).toMatchObject({
      dataset: 'ports',
      collectionVersion: 'v1',
      etag: 'sha256-v1'
    })
  })

  test('writeCollection rejects a duplicate version', async () => {
    const persistence = createFakePersistence()
    await persistence.writeCollection({
      dataset: 'ports',
      collectionVersion: 'v1',
      content: { items: [] }
    })
    await expect(
      persistence.writeCollection({
        dataset: 'ports',
        collectionVersion: 'v1',
        content: { items: [] }
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })
  })

  test('writeManifest rejects a stale expectedEtag once a manifest exists', async () => {
    const persistence = createFakePersistence()
    const first = await persistence.writeManifest({ manifest: { a: 1 } })
    await expect(
      persistence.writeManifest({
        manifest: { a: 2 },
        expectedEtag: `${first.etag}-stale`
      })
    ).rejects.toMatchObject({ code: 'collection_modified' })
  })

  test('objectExists returns false for a non-manifest target', async () => {
    const persistence = createFakePersistence()
    await expect(persistence.objectExists({ manifest: false })).resolves.toBe(
      false
    )
  })
})

describe('#createBaseFakeToolkit', () => {
  test('chains code/header calls and records the response payload', () => {
    const state = { headers: {} }
    const { chain, h } = createBaseFakeToolkit(state)

    const returned = h.response({ ok: true }).code(201).header('x-a', '1')

    expect(returned).toBe(chain)
    expect(state.payload).toEqual({ ok: true })
    expect(state.statusCode).toBe(201)
    expect(state.headers['x-a']).toBe('1')
  })
})
