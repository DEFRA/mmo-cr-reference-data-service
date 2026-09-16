import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createQueryConfiguration } from './query-configuration.js'
import { createCollectionQueryService } from './collection-query-service.js'

const config = createQueryConfiguration({
  dataset: 'vessels',
  format: 'json',
  getGuid: (r) => r.id,
  sortFields: { name: (r) => r.name }
})

describe('#collectionQueryService integration with the real In-Memory Data Store', () => {
  test('reflects the currently active collection', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      'vessels',
      {
        items: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' }]
      },
      { collectionId: 'c1', version: 'v1' }
    )
    const service = createCollectionQueryService({ store })

    expect(service.queryCollection(config, {}).totalCount).toBe(1)
  })

  test('a replaced active collection is reflected in subsequent queries', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      'vessels',
      {
        items: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' }]
      },
      { collectionId: 'c1', version: 'v1' }
    )
    const service = createCollectionQueryService({ store })
    expect(service.queryCollection(config, {}).totalCount).toBe(1)

    store.setCollection(
      'vessels',
      {
        items: [
          { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' },
          { id: '22222222-2222-4222-8222-222222222222', name: 'Beta' }
        ]
      },
      { collectionId: 'c1', version: 'v2' }
    )
    expect(service.queryCollection(config, {}).totalCount).toBe(2)
  })

  test('an unloaded dataset fails correctly', () => {
    const store = createInMemoryDataStore()
    const service = createCollectionQueryService({ store })
    expect(() => service.queryCollection(config, {})).toThrow(
      /not currently available/
    )
  })
})
