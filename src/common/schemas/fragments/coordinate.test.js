import { describe, expect, test } from 'vitest'

import { coordinateSchema } from './coordinate.js'

describe('#coordinateSchema', () => {
  test('accepts a valid coordinate', () => {
    const { error } = coordinateSchema.validate({
      latitude: 50.3661,
      longitude: -4.1427
    })

    expect(error).toBeUndefined()
  })

  test('rejects latitude out of range', () => {
    const { error } = coordinateSchema.validate({
      latitude: 91,
      longitude: 0
    })

    expect(error).toBeDefined()
  })

  test('rejects longitude out of range', () => {
    const { error } = coordinateSchema.validate({
      latitude: 0,
      longitude: -181
    })

    expect(error).toBeDefined()
  })

  test('rejects latitude without longitude', () => {
    const { error } = coordinateSchema.validate({ latitude: 50.3661 })

    expect(error).toBeDefined()
  })

  test('rejects longitude without latitude', () => {
    const { error } = coordinateSchema.validate({ longitude: -4.1427 })

    expect(error).toBeDefined()
  })
})
