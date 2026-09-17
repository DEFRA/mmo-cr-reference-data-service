// Shared request stub and authenticated-actor fixture reused by the
// collection-route-controller and geojson-collection-route-controller tests.

export function createRequest({
  authorization,
  ifNoneMatch,
  query = {},
  params = {}
} = {}) {
  return {
    app: { correlationId: 'corr-1' },
    headers: {
      ...(authorization !== undefined ? { authorization } : {}),
      ...(ifNoneMatch !== undefined ? { 'if-none-match': ifNoneMatch } : {})
    },
    query,
    params
  }
}

export const AUTHENTICATED = {
  authenticated: true,
  actor: { actorId: 'a1', permissions: ['reference-data.read'] }
}

// Minimal in-memory fake of the Persistence Module contract, shared by every test
// exercising the full-replacement/upload-validation workflow (immutable collection
// writes, conditional manifest writes, first-manifest-creation race detection).
export function createFakePersistence() {
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

// Builds the `code`/`header`/`response` chain shared by both fake Hapi
// toolkits; callers may add further chained methods (e.g. `type`) to `chain`.
export function createBaseFakeToolkit(state) {
  const chain = {
    code: (statusCode) => {
      state.statusCode = statusCode
      return chain
    },
    header: (name, value) => {
      state.headers[name] = value
      return chain
    }
  }
  return {
    chain,
    h: {
      response: (payload) => {
        state.payload = payload
        return chain
      }
    }
  }
}
