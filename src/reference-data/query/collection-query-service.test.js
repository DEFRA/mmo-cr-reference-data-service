import { describe, expect, test, vi } from 'vitest'

vi.mock('#/common/helpers/observability/metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordCounter: vi.fn(), recordDuration: vi.fn() }
})

import { createQueryConfiguration } from './query-configuration.js'
import { createCollectionQueryService } from './collection-query-service.js'

const config = createQueryConfiguration({
  dataset: 'vessels',
  format: 'json',
  getGuid: (r) => r.id,
  textSearchFields: [(r) => r.name],
  sortFields: { name: (r) => r.name },
  mobileProjector: (record) => ({ id: record.id, label: record.name })
})

const COLLECTION = {
  items: [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Beta' }
  ]
}
const METADATA = { collectionId: 'coll-1', version: 'v1' }

function createStore({ collection = COLLECTION, metadata = METADATA } = {}) {
  return {
    getCollection: vi.fn(() => collection),
    getCollectionMetadata: vi.fn(() => metadata)
  }
}

describe('#createCollectionQueryService queryCollection', () => {
  test('returns the full collection', () => {
    const service = createCollectionQueryService({ store: createStore() })
    const result = service.queryCollection(config, {})
    expect(result.totalCount).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(result.etag).toMatch(/^"sha256-/)
  })

  test('applies the mobile projector', () => {
    const service = createCollectionQueryService({ store: createStore() })
    const result = service.queryCollection(config, { view: 'mobile' })
    expect(result.items[0]).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Alpha'
    })
  })

  test('throws reference_data_unavailable when the dataset is not loaded', () => {
    const store = {
      getCollection: vi.fn(() => undefined),
      getCollectionMetadata: vi.fn(() => undefined)
    }
    const service = createCollectionQueryService({ store })
    expect(() => service.queryCollection(config, {})).toThrow(
      /not currently available/
    )
  })

  test('does not call persistence, authentication, or cache-refresh', () => {
    const store = createStore()
    const service = createCollectionQueryService({ store })
    service.queryCollection(config, {})
    expect(Object.keys(store).sort()).toEqual(
      ['getCollection', 'getCollectionMetadata'].sort()
    )
  })

  test('canonical and mobile output never leak prepareRecords enrichment fields', () => {
    const enrichingConfig = createQueryConfiguration({
      ...config,
      prepareRecords: (records) =>
        records.map((record) => ({ ...record, _searchText: record.name }))
    })
    const service = createCollectionQueryService({ store: createStore() })

    const canonical = service.queryCollection(enrichingConfig, {})
    expect(canonical.items[0]).not.toHaveProperty('_searchText')

    const mobile = service.queryCollection(enrichingConfig, { view: 'mobile' })
    expect(mobile.items[0]).not.toHaveProperty('_searchText')
  })
})

describe('#createCollectionQueryService getItemById', () => {
  test('returns the matching item', () => {
    const service = createCollectionQueryService({ store: createStore() })
    const result = service.getItemById(
      config,
      '11111111-1111-4111-8111-111111111111',
      {}
    )
    expect(result.item.name).toBe('Alpha')
  })

  test('throws reference_item_not_found for an unknown GUID', () => {
    const service = createCollectionQueryService({ store: createStore() })
    expect(() =>
      service.getItemById(config, '99999999-9999-4999-8999-999999999999', {})
    ).toThrow(/No vessels item found/)
  })

  test('rejects an invalid GUID', () => {
    const service = createCollectionQueryService({ store: createStore() })
    expect(() => service.getItemById(config, 'not-a-guid', {})).toThrow(
      /invalid GUID/
    )
  })

  test('canonical item output never leaks prepareRecords enrichment fields', () => {
    const enrichingConfig = createQueryConfiguration({
      ...config,
      prepareRecords: (records) =>
        records.map((record) => ({ ...record, _searchText: record.name }))
    })
    const service = createCollectionQueryService({ store: createStore() })
    const result = service.getItemById(
      enrichingConfig,
      '11111111-1111-4111-8111-111111111111',
      {}
    )
    expect(result.item).not.toHaveProperty('_searchText')
  })
})

describe('#createCollectionQueryService observability', () => {
  function createSpyLogger() {
    return { debug: vi.fn() }
  }

  test('logs a safe query-completion summary and records bounded metrics', async () => {
    const { recordCounter, recordDuration } =
      await import('#/common/helpers/observability/metrics.js')
    const logger = createSpyLogger()
    const service = createCollectionQueryService({
      store: createStore(),
      logger
    })

    service.queryCollection(config, { view: 'mobile' })

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reference_data.query_completed',
        dataset: 'vessels',
        view: 'mobile',
        filtered: false,
        resultCount: 2,
        totalCount: 2
      }),
      'query: completed'
    )
    expect(recordCounter).toHaveBeenCalledWith(
      'reference_data_query_requests_total',
      1,
      { dataset: 'vessels', view: 'mobile' }
    )
    expect(recordDuration).toHaveBeenCalledWith(
      'reference_data_query_duration_ms',
      expect.any(Number),
      { dataset: 'vessels', view: 'mobile' }
    )
  })

  test('never logs the free-text search query or record content', () => {
    const logger = createSpyLogger()
    const service = createCollectionQueryService({
      store: createStore(),
      logger
    })

    service.queryCollection(config, { query: 'Alpha' })

    const serialised = JSON.stringify(logger.debug.mock.calls)
    expect(serialised).not.toContain('Alpha')
    expect(logger.debug.mock.calls[0][0]).toMatchObject({ filtered: true })
  })

  test('getItemById also logs a safe completion summary', () => {
    const logger = createSpyLogger()
    const service = createCollectionQueryService({
      store: createStore(),
      logger
    })

    service.getItemById(config, '11111111-1111-4111-8111-111111111111', {})

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reference_data.query_completed',
        dataset: 'vessels',
        resultCount: 1,
        totalCount: 1
      }),
      'query: completed'
    )
  })
})

describe('#createCollectionQueryService mobile view without a configured projector', () => {
  test('raises an internal error rather than returning canonical data', () => {
    const configWithoutProjector = createQueryConfiguration({
      dataset: 'vessels',
      format: 'json',
      getGuid: (r) => r.id,
      textSearchFields: [(r) => r.name],
      sortFields: { name: (r) => r.name }
    })
    const service = createCollectionQueryService({ store: createStore() })

    expect(() =>
      service.queryCollection(configWithoutProjector, { view: 'mobile' })
    ).toThrow(/no mobile projector configured/i)
  })
})
