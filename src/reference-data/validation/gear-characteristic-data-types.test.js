import { describe, expect, test } from 'vitest'

import {
  GEAR_CHARACTERISTIC_DATA_TYPES,
  isSupportedCharacteristicDataType
} from './gear-characteristic-data-types.js'

describe('#isSupportedCharacteristicDataType', () => {
  test('accepts the approved "number" type', () => {
    expect(isSupportedCharacteristicDataType('number')).toBe(true)
  })

  test('rejects an unapproved type', () => {
    expect(isSupportedCharacteristicDataType('string')).toBe(false)
  })

  test('the approved list currently contains only "number"', () => {
    expect(GEAR_CHARACTERISTIC_DATA_TYPES).toEqual(['number'])
  })
})
