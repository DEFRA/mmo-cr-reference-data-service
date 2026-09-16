import { describe, expect, test } from 'vitest'

import { validateMapLandCollection } from './map-land-validator.js'

describe('#validateMapLandCollection', () => {
  test('is an explicit, documented no-op: no dataset-specific rule exists', () => {
    expect(
      validateMapLandCollection({ features: [{ id: 'anything' }] })
    ).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })

  test('is a no-op regardless of input, including undefined', () => {
    expect(validateMapLandCollection()).toEqual({
      valid: true,
      errors: [],
      warnings: []
    })
  })
})
