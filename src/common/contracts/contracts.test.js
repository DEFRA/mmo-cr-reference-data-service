import { describe, expect, test, vi } from 'vitest'

import { createReferenceDataRepositoryContract } from './reference-data-repository.js'
import { createInMemoryDataStoreContract } from './in-memory-data-store.js'
import { createAuthenticationClientContract } from './authentication-client.js'
import { createReferenceDataProjectorContract } from './reference-data-projector.js'

describe('#createReferenceDataRepositoryContract', () => {
  test.each([
    'readCollection',
    'writeCollection',
    'readManifest',
    'writeManifest',
    'getObjectMetadata',
    'objectExists'
  ])('%s throws not-implemented by default', (methodName) => {
    const repository = createReferenceDataRepositoryContract()
    expect(() => repository[methodName]()).toThrow(/is not implemented/)
  })

  test('accepts a test-double override', async () => {
    const readCollection = vi.fn().mockResolvedValue({ dataset: 'vessels' })
    const repository = createReferenceDataRepositoryContract({ readCollection })

    await expect(repository.readCollection()).resolves.toEqual({
      dataset: 'vessels'
    })
  })
})

describe('#createInMemoryDataStoreContract', () => {
  test.each([
    'setCollection',
    'getCollection',
    'getCollectionMetadata',
    'hasCollection',
    'listLoadedDatasets',
    'removeCollection',
    'setManifest',
    'getManifest',
    'clear'
  ])('%s throws not-implemented by default', (methodName) => {
    const store = createInMemoryDataStoreContract()
    expect(() => store[methodName]()).toThrow(/is not implemented/)
  })

  test('accepts a test-double override', () => {
    const hasCollection = vi.fn().mockReturnValue(true)
    const store = createInMemoryDataStoreContract({ hasCollection })

    expect(store.hasCollection('vessels')).toBe(true)
  })
})

describe('#createAuthenticationClientContract', () => {
  test.each(['authenticate', 'authorize'])(
    '%s throws not-implemented by default',
    (methodName) => {
      const client = createAuthenticationClientContract()
      expect(() => client[methodName]()).toThrow(/is not implemented/)
    }
  )

  test('accepts a test-double override', () => {
    const authenticate = vi.fn().mockReturnValue({ authenticated: true })
    const client = createAuthenticationClientContract({ authenticate })

    expect(client.authenticate()).toEqual({ authenticated: true })
  })
})

describe('#createReferenceDataProjectorContract', () => {
  test('project throws not-implemented by default', () => {
    const projector = createReferenceDataProjectorContract()
    expect(() => projector.project()).toThrow(/is not implemented/)
  })

  test('accepts a test-double override', () => {
    const project = vi.fn().mockReturnValue({ id: 'mobile-projection' })
    const projector = createReferenceDataProjectorContract({ project })

    expect(projector.project()).toEqual({ id: 'mobile-projection' })
  })
})
