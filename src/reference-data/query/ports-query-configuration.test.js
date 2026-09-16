import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { portsQueryConfiguration } from './ports-query-configuration.js'

function port(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: '0349',
    name: 'Plymouth',
    countryCode: 'GBR',
    coordinate: { latitude: 50.3661, longitude: -4.1427 },
    active: true,
    ...overrides
  }
}

function createService(ports) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'ports',
    { items: ports },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  return createCollectionQueryService({ store })
}

describe('#portsQueryConfiguration', () => {
  test('retrieves the full collection', () => {
    const result = createService([port()]).queryCollection(
      portsQueryConfiguration,
      {}
    )
    expect(result.totalCount).toBe(1)
  })

  test('exact port-code match is case-sensitive', () => {
    const service = createService([port()])
    expect(
      service.queryCollection(portsQueryConfiguration, { code: '0349' }).items
    ).toHaveLength(1)
    expect(
      service.queryCollection(portsQueryConfiguration, { code: 'ABCD' }).items
    ).toHaveLength(0)
  })

  test('preserves leading zeros in the port code', () => {
    const result = createService([port()]).queryCollection(
      portsQueryConfiguration,
      { code: '0349' }
    )
    expect(result.items[0].code).toBe('0349')
  })

  test('country-code match is case-insensitive', () => {
    const result = createService([port()]).queryCollection(
      portsQueryConfiguration,
      { countryCode: 'gbr' }
    )
    expect(result.items).toHaveLength(1)
  })

  test('general search matches name, code, and country code', () => {
    const service = createService([port()])
    expect(
      service.queryCollection(portsQueryConfiguration, { query: 'plymouth' })
        .items
    ).toHaveLength(1)
    expect(
      service.queryCollection(portsQueryConfiguration, { query: '0349' }).items
    ).toHaveLength(1)
    expect(
      service.queryCollection(portsQueryConfiguration, { query: 'gbr' }).items
    ).toHaveLength(1)
  })

  test('sorts by code and by countryCode', () => {
    const service = createService([
      port({
        id: '11111111-1111-4111-8111-111111111111',
        code: 'B',
        countryCode: 'FRA'
      }),
      port({
        id: '22222222-2222-4222-8222-222222222222',
        code: 'A',
        countryCode: 'GBR'
      })
    ])
    expect(
      service
        .queryCollection(portsQueryConfiguration, { sort: 'code' })
        .items.map((p) => p.code)
    ).toEqual(['A', 'B'])
    expect(
      service
        .queryCollection(portsQueryConfiguration, { sort: 'countryCode' })
        .items.map((p) => p.countryCode)
    ).toEqual(['FRA', 'GBR'])
  })

  test('mobile projection preserves GUID/code/name and coordinate', () => {
    const result = createService([port()]).queryCollection(
      portsQueryConfiguration,
      { view: 'mobile' }
    )
    expect(result.items[0]).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      code: '0349',
      name: 'Plymouth',
      displayName: 'Plymouth',
      coordinate: { latitude: 50.3661, longitude: -4.1427 }
    })
  })

  test('mobile projection returns coordinate: null when absent', () => {
    const result = createService([port({ coordinate: null })]).queryCollection(
      portsQueryConfiguration,
      { view: 'mobile' }
    )
    expect(result.items[0].coordinate).toBeNull()
  })

  describe('radius (location) search', () => {
    const nearby = port({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Nearby',
      coordinate: { latitude: 50.4, longitude: -4.2 }
    })
    const far = port({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Far',
      coordinate: { latitude: 60, longitude: 0 }
    })
    const noCoordinate = port({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'NoCoordinate',
      coordinate: null
    })

    test('requires latitude, longitude, and radiusKm together', () => {
      const service = createService([port(), nearby, far, noCoordinate])
      expect(() =>
        service.queryCollection(portsQueryConfiguration, { latitude: '50.37' })
      ).toThrow(/must be supplied together/)
      expect(() =>
        service.queryCollection(portsQueryConfiguration, {
          latitude: '50.37',
          longitude: '-4.14'
        })
      ).toThrow(/must be supplied together/)
    })

    test('includes ports within the radius and excludes those outside', () => {
      const service = createService([port(), nearby, far, noCoordinate])
      const result = service.queryCollection(portsQueryConfiguration, {
        latitude: '50.3661',
        longitude: '-4.1427',
        radiusKm: '50'
      })
      const ids = result.items.map((p) => p.id)
      expect(ids).toContain(port().id)
      expect(ids).toContain(nearby.id)
      expect(ids).not.toContain(far.id)
      expect(ids).not.toContain(noCoordinate.id)
    })

    test('a port without a coordinate never matches a radius search', () => {
      const service = createService([noCoordinate])
      const result = service.queryCollection(portsQueryConfiguration, {
        latitude: '50.3661',
        longitude: '-4.1427',
        radiusKm: '1000'
      })
      expect(result.items).toHaveLength(0)
    })

    test('combines with other filters using AND', () => {
      const service = createService([port(), nearby])
      const result = service.queryCollection(portsQueryConfiguration, {
        latitude: '50.3661',
        longitude: '-4.1427',
        radiusKm: '50',
        countryCode: 'GBR'
      })
      expect(result.items).toHaveLength(2)
    })
  })
})
