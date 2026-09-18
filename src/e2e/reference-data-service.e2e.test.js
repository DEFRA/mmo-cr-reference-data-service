// Step 28: minimal end-to-end HTTP smoke suite. Exercises the real Hapi.js API
// (Floci -> Persistence Module -> startup hydration -> In-Memory Data Store ->
// public HTTP routes -> validation-only upload -> atomic replacement -> manifest
// activation -> updated read API -> restart hydration) against a real local Floci
// instance. Requires `npm run floci:up` first; self-skips when Floci is unreachable
// so `npm test` never depends on Docker. Run explicitly with `npm run test:e2e`.
//
// Deliberately ONE sequential smoke workflow (not independent tests) — later steps
// depend on state produced by earlier ones (captured ETags, the ports replacement).
// `afterAll` always runs cleanup regardless of any earlier test failure.
//
// Authentication: production routes always use the real HTTP authentication client
// against the documented provisional contract (`POST {serviceUrl}/validate`). This
// suite starts a tiny local stub server implementing that same contract with fixed
// dummy tokens for read/write/no-permission identities — never a global auth bypass,
// never a real token, actor identity always comes from the stub's response.

import { createServer as createHttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { calculateDeterministicEtag } from '#/reference-data/query/result-etag.js'

const FLOCI_HEALTH_URL = 'http://localhost:4566/_floci/health'
const BUCKET = 'mmo-cr-reference-data-service'
const TEST_RUN_PREFIX = `e2e-${randomUUID()}`

const READ_TOKEN = 'e2e-read-token'
const WRITE_TOKEN = 'e2e-write-token'
const NO_PERMISSION_TOKEN = 'e2e-no-permission-token'
const DUMMY_AWS_SECRET = 'test'

const AUTH_IDENTITIES = {
  [READ_TOKEN]: { actorId: 'e2e-reader', permissions: ['reference-data.read'] },
  [WRITE_TOKEN]: {
    actorId: 'e2e-writer',
    permissions: ['reference-data.read', 'reference-data.write']
  },
  [NO_PERMISSION_TOKEN]: { actorId: 'e2e-none', permissions: [] }
}

const capturedLogs = vi.hoisted(() => [])
vi.mock('#/common/helpers/logging/logger.js', () => ({
  createLogger: () => {
    const record =
      (level) =>
      (...args) =>
        capturedLogs.push({ level, args })
    return {
      info: record('info'),
      warn: record('warn'),
      error: record('error'),
      debug: record('debug')
    }
  }
}))

let floccyAvailable = false
try {
  const response = await fetch(FLOCI_HEALTH_URL, {
    signal: AbortSignal.timeout(1000)
  })
  floccyAvailable = response.ok
} catch {
  floccyAvailable = false
}

// Real HTTP server speaking the documented PROVISIONAL Authentication Service
// contract, never a bypass — the production `http-authentication-client.js` code
// path is exercised for real against this.
function startStubAuthenticationServer() {
  return new Promise((resolve) => {
    const server = createHttpServer((request, response) => {
      if (request.method !== 'POST' || request.url !== '/validate') {
        response.writeHead(404).end()
        return
      }
      const authorization = request.headers.authorization ?? ''
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : null
      const identity = token ? AUTH_IDENTITIES[token] : undefined
      if (!identity) {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: 'invalid token' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(identity))
    })
    server.listen(0, () => resolve(server))
  })
}

function stopHttpServer(server) {
  return new Promise((resolve) => server.close(() => resolve()))
}

// `If-Match` is checked against the active manifest entry's deterministic
// `{collectionId, version}` etag (Step 22), which is a different value from the
// per-request collection-read ETag exposed on `GET` responses — this fetches the
// former directly from the manifest, exactly as `replaceCollection` computes it.
async function getManifestDeterministicEtag(server, dataset, readToken) {
  const manifest = await server.inject({
    method: 'GET',
    url: '/api/v1/reference-data/manifest',
    headers: { authorization: `Bearer ${readToken}` }
  })
  const entry = manifest.result.datasets.find(
    (item) => item.dataset === dataset
  )
  return calculateDeterministicEtag({
    collectionId: entry.collectionId,
    version: entry.version
  })
}

async function waitForReadiness(
  server,
  { timeoutMs = 8000, intervalMs = 100 } = {}
) {
  const deadline = Date.now() + timeoutMs
  let lastResponse
  while (Date.now() < deadline) {
    lastResponse = await server.inject({ method: 'GET', url: '/health/ready' })
    if (lastResponse.statusCode === 200) {
      return lastResponse
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(
    `Readiness was not achieved within ${timeoutMs}ms (last status ${lastResponse?.statusCode})`
  )
}

describe.skipIf(!floccyAvailable)(
  'Reference Data Service E2E smoke workflow',
  () => {
    let authServer
    let authServerUrl
    let server
    let cacheRefreshModule
    let persistenceModule
    let originalPortsEntry
    let portsEtagBeforeReplacement
    let portsEtagAfterReplacement
    let replacedPortName

    async function buildHydratedApp() {
      vi.resetModules()
      const { createServer } = await import('#/server.js')
      cacheRefreshModule =
        await import('#/reference-data/cache-refresh/index.js')
      const app = await createServer()
      await app.start()
      const hydration = await cacheRefreshModule.cacheRefresh.hydrate()
      expect(hydration.status).toBe('completed')
      return app
    }

    beforeAll(async () => {
      // This suite needs real network access to Floci and the stub authentication
      // server; the repo's global setup file auto-mocks `fetch` for every test.
      global.fetchMock?.disableMocks()

      const health = await fetch(FLOCI_HEALTH_URL)
      expect(health.ok).toBe(true)

      authServer = await startStubAuthenticationServer()
      authServerUrl = `http://localhost:${authServer.address().port}`

      vi.stubEnv('PORT', '0')
      vi.stubEnv('AWS_REGION', 'eu-west-2')
      vi.stubEnv('AWS_ACCESS_KEY_ID', DUMMY_AWS_SECRET)
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', DUMMY_AWS_SECRET)
      vi.stubEnv('AWS_ENDPOINT_URL', 'http://localhost:4566')
      vi.stubEnv('S3_FORCE_PATH_STYLE', 'true')
      vi.stubEnv('REFERENCE_DATA_BUCKET', BUCKET)
      vi.stubEnv('AUTHENTICATION_SERVICE_URL', authServerUrl)
      vi.stubEnv('REFERENCE_DATA_AUTO_START_CACHE_REFRESH', 'false')

      persistenceModule = await import('#/reference-data/persistence/index.js')
      const { bootstrapLocalReferenceData, SEED_MANIFEST_ID, SEED_TIMESTAMP } =
        await import('#/reference-data/command/bootstrap-local-reference-data.js')
      const { validateManifest } =
        await import('#/reference-data/cache-refresh/manifest-validation.js')
      const { SEED_DATASET_ORDER } =
        await import('#/reference-data/command/seed-loader.js')
      const { createInMemoryDataStore } =
        await import('#/reference-data/in-memory-store/index.js')
      const { config } = await import('#/config.js')

      // Only (re-)bootstraps when no valid manifest yet covers every mandatory dataset
      // (same guard used by the Step 27 Floci suites — safe regardless of whichever
      // Floci-dependent suite last ran against this bucket).
      const hasValidCompleteManifest = async () => {
        try {
          const { manifest } =
            await persistenceModule.persistence.readManifest()
          if (!validateManifest(manifest).valid) {
            return false
          }
          return SEED_DATASET_ORDER.every((dataset) =>
            manifest.datasets.some((entry) => entry.dataset === dataset)
          )
        } catch {
          return false
        }
      }
      if (!(await hasValidCompleteManifest())) {
        await persistenceModule.persistence.writeManifest({
          manifest: {
            manifestId: SEED_MANIFEST_ID,
            version: 'reset-baseline',
            generatedAt: SEED_TIMESTAMP,
            datasets: []
          }
        })
        const summary = await bootstrapLocalReferenceData({
          config,
          persistence: persistenceModule.persistence,
          store: createInMemoryDataStore(),
          logger: { info: () => {}, error: () => {}, warn: () => {} }
        })
        expect(summary.status).toBe('completed')
      }

      const { manifest } = await persistenceModule.persistence.readManifest()
      originalPortsEntry = manifest.datasets.find(
        (entry) => entry.dataset === 'ports'
      )

      server = await buildHydratedApp()
      await waitForReadiness(server)
    })

    afterAll(async () => {
      if (server) {
        await server.stop()
      }
      if (authServer) {
        await stopHttpServer(authServer)
      }
      // Restores the exact original active ports entry (Step 27 technique): the
      // underlying immutable seed object is never deleted, only the manifest pointer
      // moved, so this is a direct manifest write rather than a new collection version.
      if (originalPortsEntry && persistenceModule) {
        const { manifest: current, metadata } =
          await persistenceModule.persistence.readManifest()
        await persistenceModule.persistence.writeManifest({
          manifest: {
            ...current,
            datasets: current.datasets.map((entry) =>
              entry.dataset === 'ports' ? originalPortsEntry : entry
            )
          },
          expectedEtag: metadata.etag
        })
      }
      vi.unstubAllEnvs()
    })

    test('health and readiness succeed', async () => {
      const health = await server.inject({ method: 'GET', url: '/health' })
      expect(health.statusCode).toBe(200)
      expect(health.result.status).toBe('ok')

      const readiness = await server.inject({
        method: 'GET',
        url: '/health/ready'
      })
      expect(readiness.statusCode).toBe(200)
      expect(readiness.result.ready).toBe(true)
    })

    test('manifest retrieval succeeds and repeats as a bodyless 304', async () => {
      const first = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/manifest',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })

      expect(first.statusCode).toBe(200)
      expect(first.headers.etag).toBeTruthy()
      expect(first.headers['x-cdp-request-id']).toBeTruthy()
      expect(JSON.stringify(first.result)).not.toMatch(
        /mmo-cr-reference-data-service\/reference-data/
      )
      const portsEntry = first.result.datasets.find(
        (entry) => entry.dataset === 'ports'
      )
      expect(portsEntry).toBeTruthy()

      const second = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/manifest',
        headers: {
          authorization: `Bearer ${READ_TOKEN}`,
          'if-none-match': first.headers.etag
        }
      })
      expect(second.statusCode).toBe(304)
      expect(second.payload).toBe('')
      expect(second.headers.etag).toBe(first.headers.etag)
      expect(second.headers['x-cdp-request-id']).toBeTruthy()
    })

    test('representative read APIs succeed for every implemented domain', async () => {
      const authHeaders = { authorization: `Bearer ${READ_TOKEN}` }

      const vessels = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/vessels',
        headers: authHeaders
      })
      expect(vessels.statusCode).toBe(200)
      expect(vessels.result.items[0].id).toMatch(/^[0-9a-f-]{36}$/i)

      const gears = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/gears?view=mobile&vesselLengthMetres=8.5',
        headers: authHeaders
      })
      expect(gears.statusCode).toBe(200)
      expect(gears.result.context.vesselLengthBand).toBe('under-10m')

      const ports = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: authHeaders
      })
      expect(ports.statusCode).toBe(200)
      expect(ports.result.items.some((port) => port.code === 'GB007')).toBe(
        true
      )

      const species = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/species?view=mobile&countryCode=GBR',
        headers: authHeaders
      })
      expect(species.statusCode).toBe(200)
      const cod = species.result.items.find((item) => item.faoCode === 'COD')
      expect(cod.displayName).toBe('Cod')

      const statisticalAreas = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/map/statistical-areas',
        headers: authHeaders
      })
      expect(statisticalAreas.statusCode).toBe(200)
      expect(statisticalAreas.headers['content-type']).toContain(
        'application/geo+json'
      )
      expect(statisticalAreas.result.type).toBe('FeatureCollection')

      const mapPorts = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/map/ports',
        headers: authHeaders
      })
      expect(mapPorts.statusCode).toBe(200)
      expect(mapPorts.result.type).toBe('FeatureCollection')
      expect(
        mapPorts.result.features.some(
          (feature) => feature.properties.code === 'GB007'
        )
      ).toBe(true)
    })

    test('validation-only upload does not change active state', async () => {
      const boundary = '----e2e'
      function multipartBody(fileContent) {
        return [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="ports.json"',
          'Content-Type: application/json',
          '',
          fileContent,
          `--${boundary}--`,
          ''
        ].join('\r\n')
      }

      const before = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })

      const validResponse = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports?validateOnly=true',
        headers: {
          authorization: `Bearer ${WRITE_TOKEN}`,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: multipartBody(
          JSON.stringify({
            dataset: 'ports',
            collectionId: before.result.collectionId,
            schemaVersion: before.result.schemaVersion,
            version: `${TEST_RUN_PREFIX}-validate-only`,
            generatedAt: '2026-01-01T00:00:00Z',
            itemCount: before.result.items.length,
            items: before.result.items
          })
        )
      })
      expect(validResponse.statusCode).toBe(200)
      expect(validResponse.result.valid).toBe(true)

      const invalidResponse = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports?validateOnly=true',
        headers: {
          authorization: `Bearer ${WRITE_TOKEN}`,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: multipartBody(
          JSON.stringify({
            dataset: 'ports',
            collectionId: before.result.collectionId,
            schemaVersion: before.result.schemaVersion,
            version: `${TEST_RUN_PREFIX}-validate-only-invalid`,
            generatedAt: '2026-01-01T00:00:00Z',
            itemCount: 999,
            items: before.result.items
          })
        )
      })
      expect(invalidResponse.statusCode).toBe(422)
      expect(invalidResponse.result.error).toBeTruthy()

      const after = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(after.headers.etag).toBe(before.headers.etag)
    })

    test('atomic ports replacement activates a new version reflected by the read API', async () => {
      const boundary = '----e2e-replace'
      const before = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      const replacementVersion = `${TEST_RUN_PREFIX}-ports-replacement`
      const renamedPort = 'Plymouth (Step 28 E2E test)'
      replacedPortName = renamedPort
      const replacementItems = before.result.items.map((item, index) =>
        index === 0 ? { ...item, name: renamedPort } : item
      )
      const replacementCollection = JSON.stringify({
        dataset: 'ports',
        collectionId: before.result.collectionId,
        schemaVersion: before.result.schemaVersion,
        version: replacementVersion,
        generatedAt: '2026-01-01T00:00:00Z',
        itemCount: replacementItems.length,
        items: replacementItems
      })
      const multipartBody = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="ports.json"',
        'Content-Type: application/json',
        '',
        replacementCollection,
        `--${boundary}--`,
        ''
      ].join('\r\n')

      // `If-Match` is checked against the manifest entry's deterministic etag, not
      // the per-request `GET` collection ETag (see `getManifestDeterministicEtag`).
      portsEtagBeforeReplacement = await getManifestDeterministicEtag(
        server,
        'ports',
        READ_TOKEN
      )

      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports',
        headers: {
          authorization: `Bearer ${WRITE_TOKEN}`,
          'if-match': portsEtagBeforeReplacement,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: multipartBody
      })

      expect(response.statusCode).toBe(200)
      expect(response.result.version).toBe(replacementVersion)
      expect(response.headers['cache-control']).toBe('no-store')
      portsEtagAfterReplacement = response.headers.etag
      expect(portsEtagAfterReplacement).not.toBe(portsEtagBeforeReplacement)

      const manifestAfter = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/manifest',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      const portsEntryAfter = manifestAfter.result.datasets.find(
        (entry) => entry.dataset === 'ports'
      )
      expect(portsEntryAfter.version).toBe(replacementVersion)
      const vesselsEntryAfter = manifestAfter.result.datasets.find(
        (entry) => entry.dataset === 'vessels'
      )
      expect(vesselsEntryAfter.version).toBe('local-seed-1')

      const portsAfter = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(
        portsAfter.result.items.some((port) => port.name === renamedPort)
      ).toBe(true)

      const mapPortsAfter = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/map/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(
        mapPortsAfter.result.features.some(
          (feature) => feature.properties.name === renamedPort
        )
      ).toBe(true)
    })

    test('a stale If-Match is rejected and active state is unchanged', async () => {
      const boundary = '----e2e-stale'
      const staleAttempt = JSON.stringify({
        dataset: 'ports',
        collectionId: originalPortsEntry.collectionId,
        schemaVersion: '1.0',
        version: `${TEST_RUN_PREFIX}-ports-stale-attempt`,
        generatedAt: '2026-01-01T00:00:00Z',
        itemCount: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000031',
            code: 'GBPLY',
            name: 'Plymouth',
            countryCode: 'GBR',
            coordinate: { latitude: 50.3661, longitude: -4.1427 },
            active: true
          }
        ]
      })

      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports',
        headers: {
          authorization: `Bearer ${WRITE_TOKEN}`,
          'if-match': portsEtagBeforeReplacement,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="ports.json"',
          'Content-Type: application/json',
          '',
          staleAttempt,
          `--${boundary}--`,
          ''
        ].join('\r\n')
      })

      expect(response.statusCode).toBe(409)
      expect(response.result.error).toBeTruthy()

      const portsAfter = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(
        portsAfter.result.items.some((port) => port.name === replacedPortName)
      ).toBe(true)
    })

    test('a structurally invalid replacement fails and leaves active state safe', async () => {
      const boundary = '----e2e-invalid'
      const invalidReplacement = JSON.stringify({
        dataset: 'ports',
        collectionId: originalPortsEntry.collectionId,
        schemaVersion: '1.0',
        version: `${TEST_RUN_PREFIX}-ports-invalid`,
        generatedAt: '2026-01-01T00:00:00Z',
        itemCount: 5,
        items: []
      })

      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports',
        headers: {
          authorization: `Bearer ${WRITE_TOKEN}`,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="ports.json"',
          'Content-Type: application/json',
          '',
          invalidReplacement,
          `--${boundary}--`,
          ''
        ].join('\r\n')
      })

      expect(response.statusCode).toBe(422)

      const portsAfter = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(
        portsAfter.result.items.some((port) => port.name === replacedPortName)
      ).toBe(true)

      const vessels = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/vessels',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(vessels.statusCode).toBe(200)
    })

    test('restart hydration restores the replacement from Floci, not just memory', async () => {
      await server.stop()
      server = await buildHydratedApp()
      await waitForReadiness(server)

      const ports = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(
        ports.result.items.some((port) => port.name === replacedPortName)
      ).toBe(true)

      const mapPorts = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/map/ports',
        headers: { authorization: `Bearer ${READ_TOKEN}` }
      })
      expect(mapPorts.statusCode).toBe(200)
    })

    test('security and logging smoke checks', async () => {
      const noAuth = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports'
      })
      expect(noAuth.statusCode).toBe(401)

      const readOnlyAttemptingWrite = await server.inject({
        method: 'PUT',
        url: '/api/v1/reference-data/ports?validateOnly=true',
        headers: {
          authorization: `Bearer ${READ_TOKEN}`,
          'content-type': 'multipart/form-data; boundary=----unused'
        },
        payload: [
          '------unused',
          'Content-Disposition: form-data; name="file"; filename="ports.json"',
          'Content-Type: application/json',
          '',
          '{}',
          '------unused--',
          ''
        ].join('\r\n')
      })
      expect(readOnlyAttemptingWrite.statusCode).toBe(403)

      const noPermission = await server.inject({
        method: 'GET',
        url: '/api/v1/reference-data/ports',
        headers: { authorization: `Bearer ${NO_PERMISSION_TOKEN}` }
      })
      expect(noPermission.statusCode).toBe(403)

      const serialisedLogs = JSON.stringify(capturedLogs)
      expect(serialisedLogs).not.toContain(WRITE_TOKEN)
      expect(serialisedLogs).not.toContain(READ_TOKEN)
      expect(serialisedLogs).not.toContain(DUMMY_AWS_SECRET)
    })
  }
)
