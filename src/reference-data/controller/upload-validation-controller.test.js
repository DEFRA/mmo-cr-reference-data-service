import { describe, expect, test, vi } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))
vi.mock('#/common/helpers/logging/logger.js', () => ({
  createLogger: () => loggerMock
}))
vi.mock('#/common/helpers/observability/metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordCounter: vi.fn(), recordDuration: vi.fn() }
})
vi.mock('#/common/helpers/observability/audit.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordAuditEvent: vi.fn() }
})

import { createUploadValidationController } from './upload-validation-controller.js'
import {
  createBaseFakeToolkit,
  createFakePersistence,
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

describe('#createUploadValidationController observability', () => {
  function eventNames(spy) {
    return spy.mock.calls.map(([fields]) => fields.event)
  }

  test('validation-only success logs started/completed and audits a validated outcome', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) }
    })

    expect(eventNames(loggerMock.info)).toEqual([
      'reference_data.validation_upload_started',
      'reference_data.validation_upload_completed'
    ])
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'reference-data.validation-upload',
        outcome: 'validated',
        actorId: 'a1',
        resource: { type: 'reference-data-collection', dataset: 'ports' }
      })
    )
  })

  test('validation-only failure logs a warning and audits a failure outcome before throwing', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
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
    ).rejects.toThrow()

    expect(eventNames(loggerMock.warn)).toEqual([
      'reference_data.validation_upload_failed'
    ])
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', actorId: 'a1' })
    )
  })

  test('never logs uploaded collection content or tokens', async () => {
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient()
    })

    await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) }
    })

    const serialisedCalls = JSON.stringify([
      ...loggerMock.info.mock.calls,
      ...loggerMock.warn.mock.calls
    ])
    expect(serialisedCalls).not.toMatch(/write-token|authorization/i)
    expect(serialisedCalls).not.toContain(JSON.stringify(validPortsCollection))
  })

  test('a successful full replacement audits a success outcome with collection metadata', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence: createFakePersistence(),
      store: createInMemoryDataStore(),
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })

    await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) },
      query: {}
    })

    expect(eventNames(loggerMock.info)).toContain(
      'reference_data.collection_replacement_completed'
    )
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'reference-data.collection-replacement',
        outcome: 'success',
        actorId: 'a1',
        resource: expect.objectContaining({
          dataset: 'ports',
          version: validPortsCollection.version
        })
      })
    )
  })

  test('an idempotent replay audits an idempotent outcome', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence: createFakePersistence(),
      store: createInMemoryDataStore(),
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })
    const invokeReplacement = () =>
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(validPortsCollection) },
        query: {}
      })

    await invokeReplacement()
    await invokeReplacement()

    expect(recordAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'idempotent' })
    )
  })

  test('a version conflict audits a conflict outcome before rethrowing', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const persistence = createFakePersistence()
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence,
      store: createInMemoryDataStore(),
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })
    const conflicting = structuredClone(validPortsCollection)
    conflicting.items[0].name = 'A different name entirely'

    await invoke(handler, {
      authorization: 'Bearer write-token',
      payload: { file: filePart(validPortsCollection) },
      query: {}
    })

    await expect(
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(conflicting) },
        query: {}
      })
    ).rejects.toMatchObject({ code: 'collection_version_exists' })

    expect(recordAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'conflict' })
    )
  })

  test('an unexpected, non-conflict replacement failure audits a generic failure outcome', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const persistence = {
      ...createFakePersistence(),
      readManifest: async () => {
        throw new Error('S3 unavailable')
      }
    }
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence,
      store: createInMemoryDataStore(),
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })

    await expect(
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(validPortsCollection) },
        query: {}
      })
    ).rejects.toThrow('S3 unavailable')

    expect(recordAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'failure' })
    )
  })

  test('a partial in-memory publication failure audits a partial-failure outcome', async () => {
    const { recordAuditEvent } =
      await import('#/common/helpers/observability/audit.js')
    const persistence = createFakePersistence()
    const store = {
      ...createInMemoryDataStore(),
      setCollection: () => {
        throw new Error('store full')
      }
    }
    const { handler } = createUploadValidationController({
      authenticationClient: createStubAuthenticationClient(),
      persistence,
      store,
      clock: { now: () => '2026-09-17T00:00:00Z' }
    })

    await expect(
      invoke(handler, {
        authorization: 'Bearer write-token',
        payload: { file: filePart(validPortsCollection) },
        query: {}
      })
    ).rejects.toMatchObject({ partialFailure: true })

    expect(recordAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'partial-failure' })
    )
  })
})
