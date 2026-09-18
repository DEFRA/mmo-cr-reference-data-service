import { describe, expect, test } from 'vitest'

import { createInMemoryDataStore } from '#/reference-data/in-memory-store/in-memory-data-store.js'
import { createCollectionQueryService } from './collection-query-service.js'
import { vesselsQueryConfiguration } from './vessels-query-configuration.js'

function vessel(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Achilles',
    namePln: null,
    identifiers: {
      cfr: 'GBR000A1234',
      uvi: null,
      mmsi: '232001234',
      ircs: 'MABC7',
      externalMark: 'PH1234',
      registrationNumber: 'PH1234'
    },
    typeCode: 'FISHING',
    registrationCountryCode: 'GBR',
    lengthOverallMetres: 8.74,
    status: 'active',
    activeFrom: '2015-03-17',
    activeTo: null,
    ...overrides
  }
}

function createService(vessels) {
  const store = createInMemoryDataStore()
  store.setCollection(
    'vessels',
    { items: vessels },
    { collectionId: 'c1', schemaVersion: '1.0', version: 'v1' }
  )
  return createCollectionQueryService({ store })
}

describe('#vesselsQueryConfiguration', () => {
  test('retrieves the full collection', () => {
    const service = createService([vessel()])
    const result = service.queryCollection(vesselsQueryConfiguration, {})
    expect(result.totalCount).toBe(1)
  })

  test('finds a vessel by GUID', () => {
    const service = createService([vessel()])
    const result = service.getItemById(
      vesselsQueryConfiguration,
      '11111111-1111-4111-8111-111111111111',
      {}
    )
    expect(result.item.name).toBe('Achilles')
  })

  test('search by name', () => {
    const service = createService([
      vessel(),
      vessel({ id: '22222222-2222-4222-8222-222222222222', name: 'Beta' })
    ])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      query: 'achil'
    })
    expect(result.items).toHaveLength(1)
  })

  test('exact CFR filter is case-insensitive', () => {
    const service = createService([vessel()])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      cfr: 'gbr000a1234'
    })
    expect(result.items).toHaveLength(1)
  })

  test('exact MMSI filter is case-sensitive/exact', () => {
    const service = createService([vessel()])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      mmsi: '232001234'
    })
    expect(result.items).toHaveLength(1)
  })

  test('excludes inactive vessels by default', () => {
    const service = createService([vessel({ status: 'inactive' })])
    const result = service.queryCollection(vesselsQueryConfiguration, {})
    expect(result.totalCount).toBe(0)
  })

  test('includeInactive=true includes inactive vessels', () => {
    const service = createService([vessel({ status: 'inactive' })])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      includeInactive: 'true'
    })
    expect(result.totalCount).toBe(1)
  })

  test('mobile view uses the vessel projector', () => {
    const service = createService([vessel()])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      view: 'mobile'
    })
    expect(result.items[0]).toHaveProperty('displayName')
  })

  test('sorting by lengthOverallMetres', () => {
    const service = createService([
      vessel({
        id: '11111111-1111-4111-8111-111111111111',
        lengthOverallMetres: 12
      }),
      vessel({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Beta',
        lengthOverallMetres: 5
      })
    ])
    const result = service.queryCollection(vesselsQueryConfiguration, {
      sort: 'lengthOverallMetres'
    })
    expect(result.items.map((v) => v.lengthOverallMetres)).toEqual([5, 12])
  })

  test('sorting by namePln, cfr, externalMark, and registrationNumber', () => {
    const service = createService([
      vessel({
        id: '11111111-1111-4111-8111-111111111111',
        namePln: 'PZ100',
        identifiers: {
          ...vessel().identifiers,
          cfr: 'GBR000B2222',
          externalMark: 'ZZ999',
          registrationNumber: 'ZZ999'
        }
      }),
      vessel({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Beta',
        namePln: 'AB1',
        identifiers: {
          ...vessel().identifiers,
          cfr: 'GBR000A1111',
          externalMark: 'AA111',
          registrationNumber: 'AA111'
        }
      })
    ])

    expect(
      service
        .queryCollection(vesselsQueryConfiguration, { sort: 'namePln' })
        .items.map((v) => v.namePln)
    ).toEqual(['AB1', 'PZ100'])

    expect(
      service
        .queryCollection(vesselsQueryConfiguration, { sort: 'cfr' })
        .items.map((v) => v.identifiers.cfr)
    ).toEqual(['GBR000A1111', 'GBR000B2222'])

    expect(
      service
        .queryCollection(vesselsQueryConfiguration, { sort: 'externalMark' })
        .items.map((v) => v.identifiers.externalMark)
    ).toEqual(['AA111', 'ZZ999'])

    expect(
      service
        .queryCollection(vesselsQueryConfiguration, {
          sort: 'registrationNumber'
        })
        .items.map((v) => v.identifiers.registrationNumber)
    ).toEqual(['AA111', 'ZZ999'])
  })
})
