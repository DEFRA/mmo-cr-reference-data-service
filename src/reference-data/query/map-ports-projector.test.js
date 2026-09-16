import { describe, expect, test } from 'vitest'

import { projectPortsToMapPorts } from './map-ports-projector.js'

const METADATA = { collectionId: 'c1', version: 'v1' }

function buildCollection(items) {
  return { items }
}

const PORT_WITH_COORDINATE = {
  id: '11111111-1111-4111-8111-111111111111',
  code: '0349',
  name: 'Plymouth',
  countryCode: 'GBR',
  coordinate: { latitude: 50.3661, longitude: -4.1427 },
  active: true
}

const PORT_WITHOUT_COORDINATE = {
  id: '22222222-2222-4222-8222-222222222222',
  code: '9999',
  name: 'Unknown',
  countryCode: 'GBR',
  coordinate: null,
  active: true
}

describe('#projectPortsToMapPorts', () => {
  test('produces a valid FeatureCollection', () => {
    const result = projectPortsToMapPorts(
      buildCollection([PORT_WITH_COORDINATE]),
      METADATA
    )
    expect(result.type).toBe('FeatureCollection')
    expect(result.metadata.dataset).toBe('map-ports')
    expect(result.metadata.sourceDataset).toBe('ports')
    expect(result.metadata.sourceCollectionId).toBe('c1')
    expect(result.metadata.version).toBe('v1')
    expect(result.metadata.crs).toBe('EPSG:4326')
    expect(result.metadata.featureCount).toBe(1)
  })

  test('maps a port to a Point feature with longitude-first coordinates', () => {
    const result = projectPortsToMapPorts(
      buildCollection([PORT_WITH_COORDINATE]),
      METADATA
    )
    const [feature] = result.features
    expect(feature.type).toBe('Feature')
    expect(feature.id).toBe(PORT_WITH_COORDINATE.id)
    expect(feature.properties).toEqual({
      id: PORT_WITH_COORDINATE.id,
      code: '0349',
      name: 'Plymouth'
    })
    expect(feature.geometry).toEqual({
      type: 'Point',
      coordinates: [-4.1427, 50.3661]
    })
  })

  test('excludes ports without a coordinate', () => {
    const result = projectPortsToMapPorts(
      buildCollection([PORT_WITH_COORDINATE, PORT_WITHOUT_COORDINATE]),
      METADATA
    )
    expect(result.features).toHaveLength(1)
  })

  test('applies bounding-box filtering when supplied', () => {
    const bbox = {
      minLongitude: -10,
      minLatitude: 40,
      maxLongitude: 0,
      maxLatitude: 55
    }
    const outside = {
      ...PORT_WITH_COORDINATE,
      id: '33333333-3333-4333-8333-333333333333',
      coordinate: { latitude: 60, longitude: 10 }
    }
    const result = projectPortsToMapPorts(
      buildCollection([PORT_WITH_COORDINATE, outside]),
      METADATA,
      { bbox }
    )
    expect(result.features).toHaveLength(1)
    expect(result.features[0].id).toBe(PORT_WITH_COORDINATE.id)
  })

  test('does not mutate the canonical ports collection', () => {
    const collection = buildCollection([PORT_WITH_COORDINATE])
    const clone = JSON.parse(JSON.stringify(collection))
    projectPortsToMapPorts(collection, METADATA)
    expect(collection).toEqual(clone)
  })

  test('never exposes S3/persistence metadata', () => {
    const result = projectPortsToMapPorts(
      buildCollection([PORT_WITH_COORDINATE]),
      METADATA
    )
    expect(JSON.stringify(result)).not.toMatch(/bucket|floci|s3:|objectRef/i)
  })
})
