import { describe, expect, test } from 'vitest'

import { createUploadValidationController } from './upload-validation-controller.js'
import {
  createBaseFakeToolkit,
  createRequest
} from './controller-test-helpers.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

function createStubAuthenticationClient() {
  return {
    authenticate: async ({ token }) => {
      if (token === 'write-token') {
        return {
          authenticated: true,
          actor: { actorId: 'a1', permissions: ['reference-data.write'] }
        }
      }
      if (token === 'read-token') {
        return {
          authenticated: true,
          actor: { actorId: 'a1', permissions: ['reference-data.read'] }
        }
      }
      return {
        authenticated: false,
        failure: { code: 'unauthorized', message: 'x' }
      }
    }
  }
}

function createFakePersistence() {
  const objects = new Map()
  let manifestState = null
  let manifestCounter = 0

  return {
    readManifest: async () => {
      if (!manifestState) {
        const error = new Error('no active manifest')
        error.code = 'dataset_not_found'
        throw error
      }
      return {
        manifest: manifestState.manifest,
        metadata: { etag: manifestState.etag }
      }
    },
    writeCollection: async ({ dataset, collectionVersion, content }) => {
      const key = `${dataset}/${collectionVersion}`
      if (objects.has(key)) {
        const error = new Error('collection version already exists')
        error.code = 'collection_version_exists'
        throw error
      }
      objects.set(key, content)
      return {
        dataset,
        collectionVersion,
        etag: `sha256-${collectionVersion}`,
        sizeBytes: JSON.stringify(content).length,
        lastModifiedAt: '2026-09-17T00:00:00Z'
      }
    },
    writeManifest: async ({ manifest, expectedEtag }) => {
      if (
        manifestState &&
        expectedEtag !== undefined &&
        expectedEtag !== manifestState.etag
      ) {
        const error = new Error('manifest modified concurrently')
        error.code = 'collection_modified'
        throw error
      }
      manifestCounter += 1
      const etag = `manifest-etag-${manifestCounter}`
      manifestState = { manifest, etag }
      return { etag }
    },
    objectExists: async ({ manifest }) =>
      manifest ? manifestState !== null : false
  }
}

function filePart(payload, contentType = 'application/json') {
  return {
    filename: 'collection.json',
    headers: { 'content-type': contentType },
    payload
  }
}

function invoke(
  handler,
  {
    authorization,
    payload,
    params = { dataset: 'ports' },
    query = { validateOnly: 'true' }
  }
) {
  const request = createRequest({ authorization, params, query })
  request.payload = payload
  const state = { headers: {} }
  const { h } = createBaseFakeToolkit(state)
  return handler(request, h).then(() => state)
}

describe('#createUploadValidationController (validation-only mode)', () => {
  test('rejects an unauthenticated request', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    await expect(
      invoke(handler, { payload: { file: filePart(validPortsCollection) } })
    ).rejects.toThrow()
  })

  test('rejects read-only permission', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    await expect(
      invoke(handler, {
        authorization: 'Bearer read-token',
        payload: { file: filePart(validPortsCollection) }
      })
    ).rejects.toThrow()
  })

  test('returns a successful validation summary for a valid collection', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    const state = await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) }
    })

    expect(state.statusCode).toBe(200)
    expect(state.headers['Cache-Control']).toBe('no-store')
    expect(state.payload).toMatchObject({
      dataset: 'ports',
      valid: true,
      schemaVersion: '1.0',
      version: validPortsCollection.version,
      receivedItemCount: 1,
      normalisedItemCount: 1,
      changed: false,
      warnings: []
    })
  })

  test('throws a business-validation-failed error for an invalid collection', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    await expect(
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(duplicated) }
      })
    ).rejects.toMatchObject({
      code: 'business_validation_failed',
      dataset: 'ports'
    })
  })

  test('throws an invalid_request error for a missing file', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    await expect(
      invoke(handler, { authorization: 'Bearer write-token', payload: {} })
    ).rejects.toMatchObject({ code: 'invalid_request' })
  })
})

describe('#createUploadValidationController (atomic full replacement)', () => {
  function buildController() {
    return createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence: createFakePersistence(),
      store: createInMemoryDataStore(),
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })
  }

  test('activates a first collection when validateOnly is absent', async () => {
    const { handler } = buildController()

    const state = await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) },
      query: {}
    })

    expect(state.statusCode).toBe(200)
    expect(state.headers['Cache-Control']).toBe('no-store')
    expect(state.headers.ETag).toBeDefined()
    expect(state.payload).toMatchObject({
      dataset: 'ports',
      status: 'active',
      version: validPortsCollection.version
    })
  })

  test('returns an idempotent result on replay', async () => {
    const { handler } = buildController()
    const invokeReplacement = (query) =>
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(validPortsCollection) },
        query
      })

    await invokeReplacement({})
    const state = await invokeReplacement({})

    expect(state.payload.idempotent).toBe(true)
  })

  test('throws a business-validation-failed error without persisting anything', async () => {
    const { handler } = buildController()
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    await expect(
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(duplicated) },
        query: {}
      })
    ).rejects.toMatchObject({ code: 'business_validation_failed' })
  })

  test('requires write permission for full replacement too', async () => {
    const { handler } = buildController()

    await expect(
      invoke(handler, {
        authorization: 'Bearer read-token',
        payload: { file: filePart(validPortsCollection) },
        query: {}
      })
    ).rejects.toThrow()
  })
})
