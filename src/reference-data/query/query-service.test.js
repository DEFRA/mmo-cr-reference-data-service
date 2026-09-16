import { describe, expect, test, vi } from 'vitest'

import { createQueryService } from './query-service.js'

function createFakeStore(manifest) {
  return { getManifest: vi.fn(() => manifest) }
}

const VALID_MANIFEST = {
  manifestId: 'c7b49c26-d6c0-4ab1-9318-cd1c862f4768',
  version: '2026.09.11.3',
  generatedAt: '2026-09-11T08:32:14Z',
  datasets: [
    {
      dataset: 'ports',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      format: 'json',
      etag: '"a"',
      itemCount: 1,
      lastModified: '2026-09-11T08:30:00Z'
    }
  ]
}

describe('#createQueryService getManifest', () => {
  test('returns the projected manifest when active state is available', () => {
    const store = createFakeStore(VALID_MANIFEST)
    const query = createQueryService({ store })

    const result = query.getManifest()

    expect(result.body.manifestId).toBe(VALID_MANIFEST.manifestId)
    expect(result.body.datasets).toHaveLength(1)
    expect(store.getManifest).toHaveBeenCalledTimes(1)
  })

  test('applies the include filter', () => {
    const store = createFakeStore(VALID_MANIFEST)
    const query = createQueryService({ store })

    const result = query.getManifest({ include: 'ports' })

    expect(result.body.datasets.map((entry) => entry.dataset)).toEqual([
      'ports'
    ])
  })

  test('throws reference_data_unavailable when hydration has not completed', () => {
    const store = createFakeStore(null)
    const query = createQueryService({ store })

    expect(() => query.getManifest()).toThrow(
      /Reference data is not yet available/
    )
    try {
      query.getManifest()
    } catch (error) {
      expect(error.code).toBe('reference_data_unavailable')
      expect(error.retryable).toBe(true)
    }
  })

  test('rejects an invalid include value before reading the store', () => {
    const store = createFakeStore(VALID_MANIFEST)
    const query = createQueryService({ store })

    expect(() => query.getManifest({ include: 'unknown' })).toThrow(
      /Unsupported dataset/
    )
  })

  test('never calls persistence, authentication, or cache-refresh dependencies', () => {
    const store = createFakeStore(VALID_MANIFEST)
    const query = createQueryService({ store })

    query.getManifest()

    expect(Object.keys(store)).toEqual(['getManifest'])
  })
})
