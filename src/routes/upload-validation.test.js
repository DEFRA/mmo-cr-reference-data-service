import { describe, expect, test, afterAll, beforeEach } from 'vitest'

import { uploadValidationRouteOptions } from './upload-validation.js'
import { createUploadValidationController } from '#/reference-data/controller/upload-validation-controller.js'
import { createInMemoryDataStore } from '#/reference-data/in-memory-store/index.js'
import {
  createStubAuthenticationClient,
  buildTestServerWithRoutes
} from '#/routes/route-test-helpers.js'
import validPortsCollection from '#/common/schemas/fixtures/valid/ports.json' with { type: 'json' }

const UPLOAD_PATH = '/__test/reference-data/{dataset}'

function createWriteCapableAuthenticationClient() {
  const base = createStubAuthenticationClient()
  return {
    authenticate: async ({ token }) => {
      if (token === 'write-token') {
        return {
          authenticated: true,
          actor: { actorId: 'a1', permissions: ['reference-data.write'] }
        }
      }
      return base.authenticate({ token })
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

let server

async function buildServer() {
  const { handler } = createUploadValidationController({
    authenticationClient: createWriteCapableAuthenticationClient(),
    persistence: createFakePersistence(),
    store: createInMemoryDataStore(),
    clock: { now: () => '2026-09-17T00:00:00Z' }
  })

  return buildTestServerWithRoutes([
    {
      method: 'PUT',
      path: UPLOAD_PATH,
      options: uploadValidationRouteOptions,
      handler
    }
  ])
}

function buildMultipartBody({
  boundary = '----test',
  fileName = 'collection.json',
  fileContentType = 'application/json',
  fileContent,
  fields = {}
}) {
  const parts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
    `Content-Type: ${fileContentType}`,
    '',
    fileContent
  ]
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}`,
      `Content-Disposition: form-data; name="${name}"`,
      '',
      value
    )
  }
  parts.push(`--${boundary}--`, '')
  return parts.join('\r\n')
}

function injectUploadOn(targetServer) {
  return async function injectUpload({
    dataset = 'ports',
    validateOnly = 'true',
    authorization = 'Bearer write-token',
    ifMatch,
    omitFile = false,
    ...bodyOptions
  } = {}) {
    const boundary = '----test'
    const url = `${UPLOAD_PATH.replace('{dataset}', dataset)}${
      validateOnly === null ? '' : `?validateOnly=${validateOnly}`
    }`

    return targetServer.inject({
      method: 'PUT',
      url,
      headers: {
        ...(authorization !== null ? { authorization } : {}),
        ...(ifMatch !== undefined ? { 'if-match': ifMatch } : {}),
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: omitFile
        ? [`--${boundary}--`, ''].join('\r\n')
        : buildMultipartBody({ boundary, ...bodyOptions })
    })
  }
}

describe('PUT /api/v1/reference-data/{dataset}?validateOnly=true', () => {
  let injectUpload

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('validates a valid ports collection', async () => {
    server = await buildServer()
    injectUpload = injectUploadOn(server)

    const res = await injectUpload({
      fileContent: JSON.stringify(validPortsCollection)
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = JSON.parse(res.payload)
    expect(body).toMatchObject({
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

  test('rejects the derived map-ports dataset', async () => {
    const res = await injectUpload({ dataset: 'map-ports', fileContent: '{}' })
    expect(res.statusCode).toBe(400)
  })

  test('rejects an invalid validateOnly representation', async () => {
    const res = await injectUpload({
      validateOnly: 'yes',
      fileContent: '{}'
    })
    expect(res.statusCode).toBe(400)
  })

  test('rejects a missing file', async () => {
    const res = await injectUpload({ omitFile: true })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload).error.code).toBe('invalid_request')
  })

  test('rejects a malformed JSON file', async () => {
    const res = await injectUpload({ fileContent: 'not json{{{' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload).error.code).toBe('invalid_json')
  })

  test('rejects an unsupported media type', async () => {
    const res = await injectUpload({
      fileContentType: 'text/csv',
      fileContent: 'a,b,c'
    })
    expect(res.statusCode).toBe(415)
  })

  test('rejects a structurally invalid collection', async () => {
    const res = await injectUpload({ fileContent: '{"dataset":"ports"}' })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.payload).error.code).toBe('schema_validation_failed')
  })

  test('rejects a business-invalid collection', async () => {
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    const res = await injectUpload({ fileContent: JSON.stringify(duplicated) })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.payload).error.code).toBe(
      'business_validation_failed'
    )
  })

  test('surfaces normalisation warnings', async () => {
    const collection = structuredClone(validPortsCollection)
    collection.items[0].code = '  GBPLY  '

    const res = await injectUpload({ fileContent: JSON.stringify(collection) })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.changed).toBe(true)
    expect(
      body.warnings.some((warning) => warning.code === 'whitespace_trimmed')
    ).toBe(true)
  })

  test('rejects a request without write permission', async () => {
    const res = await injectUpload({
      authorization: 'Bearer read-token',
      fileContent: JSON.stringify(validPortsCollection)
    })
    expect(res.statusCode).toBe(403)
  })

  test('rejects an unauthenticated request', async () => {
    const res = await injectUpload({
      authorization: null,
      fileContent: JSON.stringify(validPortsCollection)
    })
    expect(res.statusCode).toBe(401)
  })

  test('validates a valid GeoJSON map-land collection', async () => {
    const res = await injectUpload({
      dataset: 'map-land',
      fileContentType: 'application/geo+json',
      fileContent: JSON.stringify({
        dataset: 'map-land',
        collectionId: '11111111-1111-4111-8111-111111111111',
        schemaVersion: '1.0',
        version: '2026.09.17.1',
        generatedAt: '2026-09-17T00:00:00Z',
        itemCount: 0,
        type: 'FeatureCollection',
        features: []
      })
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body).toMatchObject({ dataset: 'map-land', valid: true })
    expect(body.receivedFeatureCount).toBe(0)
  })
})

describe('PUT /api/v1/reference-data/{dataset} (atomic full replacement)', () => {
  let replacementServer
  let injectUpload

  beforeEach(async () => {
    replacementServer = await buildServer()
    injectUpload = injectUploadOn(replacementServer)
  })

  afterAll(async () => {
    if (replacementServer) {
      await replacementServer.stop()
    }
  })

  test('activates the first version of a collection when validateOnly is absent', async () => {
    const res = await injectUpload({
      validateOnly: null,
      fileContent: JSON.stringify(validPortsCollection)
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers.etag).toBeDefined()
    const body = JSON.parse(res.payload)
    expect(body).toMatchObject({
      dataset: 'ports',
      status: 'active',
      version: validPortsCollection.version
    })
    expect(body.previousCollection).toBeUndefined()
  })

  test('activates via validateOnly=false explicitly', async () => {
    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).status).toBe('active')
  })

  test('replaces an active collection and reports previous metadata', async () => {
    await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })

    const next = structuredClone(validPortsCollection)
    next.version = '2026.09.18.1'

    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(next)
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.version).toBe('2026.09.18.1')
    expect(body.previousCollection.version).toBe(validPortsCollection.version)
  })

  test('returns an idempotent replay for the same active version and content', async () => {
    await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })

    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).idempotent).toBe(true)
  })

  test('rejects the same version with different content', async () => {
    await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })

    const changed = structuredClone(validPortsCollection)
    changed.items[0].name = 'Changed'

    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(changed)
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.payload).error.code).toBe('collection_version_exists')
  })

  test('rejects a stale If-Match header', async () => {
    await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })

    const next = structuredClone(validPortsCollection)
    next.version = '2026.09.18.1'

    const res = await injectUpload({
      validateOnly: 'false',
      ifMatch: '"sha256-stale"',
      fileContent: JSON.stringify(next)
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.payload).error.code).toBe('collection_modified')
  })

  test('rejects map-ports', async () => {
    const res = await injectUpload({
      dataset: 'map-ports',
      validateOnly: null,
      fileContent: '{}'
    })
    expect(res.statusCode).toBe(400)
  })

  test('rejects a business-invalid collection without persisting anything', async () => {
    const duplicated = structuredClone(validPortsCollection)
    duplicated.itemCount = 2
    duplicated.items.push(structuredClone(duplicated.items[0]))

    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(duplicated)
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.payload).error.code).toBe(
      'business_validation_failed'
    )
  })

  test('requires write permission', async () => {
    const res = await injectUpload({
      validateOnly: 'false',
      authorization: 'Bearer read-token',
      fileContent: JSON.stringify(validPortsCollection)
    })
    expect(res.statusCode).toBe(403)
  })

  test('a successful replacement is immediately visible via the in-memory store', async () => {
    await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })
    // The manifest and collection are published synchronously before the response is
    // returned, so a second, unrelated request against the same server sees the change.
    const res = await injectUpload({
      validateOnly: 'false',
      fileContent: JSON.stringify(validPortsCollection)
    })
    expect(JSON.parse(res.payload).idempotent).toBe(true)
  })
})
