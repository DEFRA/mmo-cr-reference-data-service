import { describe, expect, test } from 'vitest'

import {
  VESSEL_LENGTH_BANDS,
  isSupportedVesselLengthBand
} from './vessel-length-bands.js'

describe('#isSupportedVesselLengthBand', () => {
  test('accepts the three canonical bands', () => {
    expect(isSupportedVesselLengthBand('under-10m')).toBe(true)
    expect(isSupportedVesselLengthBand('10-to-12m')).toBe(true)
    expect(isSupportedVesselLengthBand('over-12m')).toBe(true)
  })

  test('rejects an alias or unknown value', () => {
    expect(isSupportedVesselLengthBand('under-ten-metres')).toBe(false)
  })

  test('exposes exactly the three canonical bands', () => {
    expect(VESSEL_LENGTH_BANDS).toEqual(['under-10m', '10-to-12m', 'over-12m'])
  })
})
