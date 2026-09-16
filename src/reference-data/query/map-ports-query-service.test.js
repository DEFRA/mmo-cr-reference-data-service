import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createMapPortsQueryService } from './map-ports-query-service.js'

const PORT = {
  id: '11111111-1111-4111-8111-111111111111',
  code: '0349',
  name: 'Plymouth',
  countryCode: 'GBR',
  coordinate: { latitude: 50.3661, longitude: -4.1427 },
  active: true
}

function createService(ports = [PORT]) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'ports',
    { items: ports },
    { collectionId: 'c1', version: 'v1' }
  )
  return createMapPortsQueryService({ store })
}

describe('#createMapPortsQueryService getMapPorts', () => {
  test('returns the derived GeoJSON FeatureCollection', () => {
    const result = createService().getMapPorts({})
    expect(result.body.type).toBe('FeatureCollection')
    expect(result.body.features).toHaveLength(1)
    expect(result.etag).toMatch(/^"sha256-/)
  })

  test('applies a valid bbox filter', () => {
    const result = createService().getMapPorts({
      bbox: '-10,40,0,55'
    })
    expect(result.body.features).toHaveLength(1)
  })

  test('rejects an invalid bbox', () => {
    expect(() => createService().getMapPorts({ bbox: 'not-a-bbox' })).toThrow()
  })

  test('rejects an unsupported query parameter', () => {
    expect(() => createService().getMapPorts({ view: 'mobile' })).toThrow(
      /Unsupported query parameter/
    )
  })

  test('throws reference_data_unavailable when ports is not loaded', () => {
    const store = createInMemoryDataStore()
    const service = createMapPortsQueryService({ store })
    expect(() => service.getMapPorts({})).toThrow(/not currently available/)
  })

  test('does not access persistence, authentication, or cache-refresh', () => {
    const store = createInMemoryDataStore()
    store.setCollection(
      'ports',
      { items: [PORT] },
      { collectionId: 'c1', version: 'v1' }
    )
    const service = createMapPortsQueryService({ store })
    service.getMapPorts({})
    expect(Object.keys(store)).not.toContain('readManifest')
  })
})
