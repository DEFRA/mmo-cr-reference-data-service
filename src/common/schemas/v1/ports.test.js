import { describe, expect, test } from 'vitest'

import { portItemSchema, portsCollectionSchema } from './ports.js'

const validPort = {
  id: '73168db4-1996-46f8-91cb-2288fe2e689c',
  code: 'GBPLY',
  name: 'Plymouth',
  countryCode: 'GBR',
  coordinate: { latitude: 50.3661, longitude: -4.1427 },
  active: true
}

describe('#portItemSchema', () => {
  test('accepts a valid port with a coordinate', () => {
    expect(portItemSchema.validate(validPort).error).toBeUndefined()
  })

  test('accepts a port without a coordinate', () => {
    const { coordinate, ...withoutCoordinate } = validPort

    expect(portItemSchema.validate(withoutCoordinate).error).toBeUndefined()
  })

  test('accepts a port with a null coordinate', () => {
    expect(
      portItemSchema.validate({ ...validPort, coordinate: null }).error
    ).toBeUndefined()
  })

  test('rejects an out-of-range coordinate', () => {
    const { error } = portItemSchema.validate({
      ...validPort,
      coordinate: { latitude: 91, longitude: -4.1427 }
    })

    expect(error).toBeDefined()
  })

  test('rejects an incomplete coordinate object', () => {
    const { error } = portItemSchema.validate({
      ...validPort,
      coordinate: { latitude: 50.3661 }
    })

    expect(error).toBeDefined()
  })
})

describe('#portsCollectionSchema', () => {
  test('accepts a valid ports collection', () => {
    const collection = {
      dataset: 'ports',
      collectionId: '0be553de-f430-49f7-b120-1e8e5ad972dc',
      schemaVersion: '1.0',
      version: '2026.09.11.1',
      generatedAt: '2026-09-11T08:30:00Z',
      itemCount: 1,
      items: [validPort]
    }

    expect(portsCollectionSchema.validate(collection).error).toBeUndefined()
  })
})
